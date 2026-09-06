import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { LeadService } from './lead.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SmsService } from 'src/sms/sms.service';
import { LegalDocumentService } from 'src/legal-document/legal-document.service';
import { ChatFlowService } from 'src/chat-flow/chat-flow.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { MixpanelService } from 'src/analytics/mixpanel.service';

// Shared stub — LeadService fires Mixpanel calls fire-and-forget; tests
// never assert on them.
const mixpanelStub = {
  resolveTeamOwner: jest.fn().mockResolvedValue({ ownerId: null }),
  track: jest.fn(),
};

describe('LeadService — lead verification', () => {
  let service: LeadService;
  let prisma: {
    customerBots: { findUnique: jest.Mock };
    leadVerification: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    botLeads: { create: jest.Mock };
    teamMember: { findFirst: jest.Mock };
  };
  let mail: { sendLeadVerificationCode: jest.Mock; sendLeadNotification: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  const botId = 'bot-1';
  const email = 'visitor@example.com';

  beforeEach(async () => {
    prisma = {
      customerBots: { findUnique: jest.fn() },
      leadVerification: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      botLeads: { create: jest.fn() },
      teamMember: { findFirst: jest.fn() },
    };
    mail = { sendLeadVerificationCode: jest.fn(), sendLeadNotification: jest.fn() };
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: JwtService, useValue: jwt },
        { provide: SmsService, useValue: { sendOtpSms: jest.fn() } },
        {
          provide: LegalDocumentService,
          useValue: { getPublished: jest.fn().mockRejectedValue(new Error('no published version in tests')) },
        },
        {
          provide: ChatFlowService,
          useValue: { transition: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]) },
        },
        { provide: PushNotificationService, useValue: { sendToUsers: jest.fn(), sendToUser: jest.fn() } },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();

    service = module.get(LeadService);
  });

  describe('requestVerification', () => {
    it('rejects when the bot does not require verification', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadVerificationRequired: false,
      });

      await expect(
        service.requestVerification({ botId, email }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rate-limits after 3 requests in the 15-minute window', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadVerificationRequired: true,
      });
      prisma.leadVerification.count.mockResolvedValue(3);

      const result = await service.requestVerification({ botId, email });

      expect(result).toEqual({ status: 'rate_limited' });
      expect(prisma.leadVerification.create).not.toHaveBeenCalled();
    });

    it('generates and emails a code when allowed', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadVerificationRequired: true,
      });
      prisma.leadVerification.count.mockResolvedValue(0);
      prisma.leadVerification.create.mockResolvedValue({ id: 'lv-1' });

      const result = await service.requestVerification({ botId, email });

      expect(result.status).toBe('sent');
      expect(prisma.leadVerification.create).toHaveBeenCalledTimes(1);
      expect(mail.sendLeadVerificationCode).toHaveBeenCalledWith(
        email,
        expect.stringMatching(/^\d{6}$/),
        'Test Bot',
        'en',
      );
    });
  });

  describe('verifyCode', () => {
    it('returns not_found when no verification row exists', async () => {
      prisma.leadVerification.findFirst.mockResolvedValue(null);

      const result = await service.verifyCode({ botId, email, code: '123456' });

      expect(result).toEqual({ verified: false, reason: 'not_found' });
    });

    it('returns expired for a stale row', async () => {
      prisma.leadVerification.findFirst.mockResolvedValue({
        id: 'lv-1',
        codeHash: 'irrelevant',
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.verifyCode({ botId, email, code: '123456' });

      expect(result).toEqual({ verified: false, reason: 'expired' });
    });

    it('locks out after too many attempts', async () => {
      prisma.leadVerification.findFirst.mockResolvedValue({
        id: 'lv-1',
        codeHash: 'irrelevant',
        attempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyCode({ botId, email, code: '123456' });

      expect(result).toEqual({ verified: false, reason: 'too_many_attempts' });
    });

    it('increments attempts and rejects a wrong code', async () => {
      prisma.leadVerification.findFirst.mockResolvedValue({
        id: 'lv-1',
        codeHash: crypto.createHash('sha256').update('999999').digest('hex'),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyCode({ botId, email, code: '111111' });

      expect(result).toEqual({ verified: false, reason: 'wrong_code' });
      expect(prisma.leadVerification.update).toHaveBeenCalledWith({
        where: { id: 'lv-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('marks the row used and issues a lead_verification JWT on the correct code', async () => {
      const code = '654321';
      prisma.leadVerification.findFirst.mockResolvedValue({
        id: 'lv-1',
        codeHash: crypto.createHash('sha256').update(code).digest('hex'),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });
      jwt.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.verifyCode({ botId, email, code });

      expect(result).toEqual({ verified: true, verificationToken: 'signed.jwt.token' });
      expect(prisma.leadVerification.update).toHaveBeenCalledWith({
        where: { id: 'lv-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { email, botId, kind: 'lead_verification', sub: 'lv-1' },
        expect.objectContaining({ expiresIn: 30 * 60 }),
      );
    });
  });

  describe('submit — verification gating', () => {
    const leadData = { email };

    it('rejects when verification is required but no token is provided', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadDestinations: [],
        leadVerificationRequired: true,
      });

      await expect(
        service.submit({ botId, chatId: null, leadData }),
      ).rejects.toThrow(BadRequestException);
    });

    it('audits a rejected attempt when no token is provided (bot owner must see the failed visit)', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadDestinations: [],
        leadVerificationRequired: true,
      });

      await expect(
        service.submit({ botId, chatId: 'chat-1', leadData }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.botLeads.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          botId,
          chatId: 'chat-1',
          leadData: { email },
          channelsAttempted: [],
          channelsSucceeded: [],
          deliveryErrors: [{ channel: 'none', error: 'verification_required' }],
          verified: false,
        }),
      });
    });

    it('rejects a token issued for a different purpose (wrong kind)', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadDestinations: [],
        leadVerificationRequired: true,
      });
      jwt.verifyAsync.mockResolvedValue({ email, botId, kind: 'booking' });

      await expect(
        service.submit({ botId, chatId: null, leadData, verificationToken: 'booking.jwt' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('audits a rejected attempt when the token is invalid', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        leadDestinations: [],
        leadVerificationRequired: true,
      });
      jwt.verifyAsync.mockResolvedValue({ email, botId, kind: 'booking' });

      await expect(
        service.submit({ botId, chatId: null, leadData, verificationToken: 'booking.jwt' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.botLeads.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deliveryErrors: [{ channel: 'none', error: 'verification_invalid' }],
          verified: false,
        }),
      });
    });

    it('accepts a valid lead_verification token and marks the lead verified', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        teamId: 'team-1',
        leadDestinations: [],
        leadVerificationRequired: true,
      });
      jwt.verifyAsync.mockResolvedValue({ email, botId, kind: 'lead_verification' });
      prisma.teamMember.findFirst.mockResolvedValue({
        user: { email: 'owner@example.com' },
      });
      prisma.botLeads.create.mockResolvedValue({ id: 'lead-1' });

      await service.submit({ botId, chatId: null, leadData, verificationToken: 'lead.jwt' });

      expect(prisma.botLeads.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verified: true }) }),
      );
    });

    it('leaves verified false when the bot does not require verification', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        teamId: 'team-1',
        leadDestinations: [],
        leadVerificationRequired: false,
      });
      prisma.teamMember.findFirst.mockResolvedValue({
        user: { email: 'owner@example.com' },
      });
      prisma.botLeads.create.mockResolvedValue({ id: 'lead-1' });

      await service.submit({ botId, chatId: null, leadData });

      expect(prisma.botLeads.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verified: false }) }),
      );
    });
  });

  describe('submit — leadDestinations fallback', () => {
    const leadData = { email };

    it('falls back to the team owner email when leadDestinations is empty', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        teamId: 'team-1',
        leadDestinations: [],
        leadVerificationRequired: false,
      });
      prisma.teamMember.findFirst.mockResolvedValue({
        user: { email: 'owner@example.com' },
        email: null,
      });
      prisma.botLeads.create.mockResolvedValue({ id: 'lead-1' });

      const result = await service.submit({ botId, chatId: null, leadData });

      expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', role: 'TEAM_OWNER' },
        include: { user: true },
      });
      expect(mail.sendLeadNotification).toHaveBeenCalledWith(
        'owner@example.com',
        'Test Bot',
        expect.objectContaining({ email }),
        'en',
      );
      expect(result.status).toBe('delivered');
    });

    it('uses TeamMember.email when the owner has no linked User (pending invite edge case)', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        teamId: 'team-1',
        leadDestinations: [],
        leadVerificationRequired: false,
      });
      prisma.teamMember.findFirst.mockResolvedValue({
        user: null,
        email: 'pending-owner@example.com',
      });
      prisma.botLeads.create.mockResolvedValue({ id: 'lead-1' });

      await service.submit({ botId, chatId: null, leadData });

      expect(mail.sendLeadNotification).toHaveBeenCalledWith(
        'pending-owner@example.com',
        'Test Bot',
        expect.objectContaining({ email }),
        'en',
      );
    });

    it('records no_destinations_and_no_team_owner when no owner email exists at all', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        teamId: 'team-1',
        leadDestinations: [],
        leadVerificationRequired: false,
      });
      prisma.teamMember.findFirst.mockResolvedValue(null);
      prisma.botLeads.create.mockResolvedValue({ id: 'lead-1' });

      const result = await service.submit({ botId, chatId: null, leadData });

      expect(mail.sendLeadNotification).not.toHaveBeenCalled();
      expect(prisma.botLeads.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deliveryErrors: [{ channel: 'none', error: 'no_destinations_and_no_team_owner' }],
        }),
      });
      expect(result.status).toBe('failed');
    });

    it('honors explicit leadDestinations without falling back', async () => {
      prisma.customerBots.findUnique.mockResolvedValue({
        id: botId,
        botName: 'Test Bot',
        teamId: 'team-1',
        leadDestinations: [
          { channel: 'email', target: 'configured@example.com', enabled: true },
        ],
        leadVerificationRequired: false,
      });
      prisma.botLeads.create.mockResolvedValue({ id: 'lead-1' });

      await service.submit({ botId, chatId: null, leadData });

      expect(prisma.teamMember.findFirst).not.toHaveBeenCalled();
      expect(mail.sendLeadNotification).toHaveBeenCalledWith(
        'configured@example.com',
        'Test Bot',
        expect.any(Object),
        'en',
      );
    });
  });
});

describe('LeadService — hasFreshKvkkConsent (gateway pre-agent probe)', () => {
  let service: LeadService;
  let leadPrivacyConsent: { findFirst: jest.Mock };
  let customerBots: { findUnique: jest.Mock };

  beforeEach(async () => {
    leadPrivacyConsent = { findFirst: jest.fn() };
    customerBots = {
      findUnique: jest.fn().mockResolvedValue({ kvkkConsentRequired: true }),
    };
    const prisma: any = { leadPrivacyConsent, customerBots };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: (await import('src/sms/sms.service')).SmsService, useValue: {} },
        { provide: LegalDocumentService, useValue: {} },
        { provide: ChatFlowService, useValue: {} },
        { provide: PushNotificationService, useValue: {} },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();
    service = module.get(LeadService);
  });

  it('returns fresh:false when botId is empty (short-circuits without a DB call)', async () => {
    const result = await service.hasFreshKvkkConsent('', 'chat-1');
    expect(result).toEqual({ fresh: false });
    expect(leadPrivacyConsent.findFirst).not.toHaveBeenCalled();
  });

  it('returns fresh:false when chatId is empty (short-circuits without a DB call)', async () => {
    const result = await service.hasFreshKvkkConsent('bot-1', '');
    expect(result).toEqual({ fresh: false });
    expect(leadPrivacyConsent.findFirst).not.toHaveBeenCalled();
  });

  it('returns fresh:false when no consent row exists in the 60-minute window', async () => {
    leadPrivacyConsent.findFirst.mockResolvedValue(null);
    const result = await service.hasFreshKvkkConsent('bot-1', 'chat-1');
    expect(result).toEqual({ fresh: false });
    // Verify the query used the same 60-min freshness window as requestSmsVerification
    const call = leadPrivacyConsent.findFirst.mock.calls[0][0];
    expect(call.where.botId).toBe('bot-1');
    expect(call.where.chatId).toBe('chat-1');
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('returns fresh:true when a consent row exists in the window', async () => {
    leadPrivacyConsent.findFirst.mockResolvedValue({ id: 'consent-1' });
    const result = await service.hasFreshKvkkConsent('bot-1', 'chat-1');
    expect(result).toEqual({ fresh: true });
  });

  it('selects only the id field (never leaks PII in the response)', async () => {
    leadPrivacyConsent.findFirst.mockResolvedValue({ id: 'consent-1' });
    await service.hasFreshKvkkConsent('bot-1', 'chat-1');
    const call = leadPrivacyConsent.findFirst.mock.calls[0][0];
    expect(call.select).toEqual({ id: true });
  });

  it('returns fresh:true without a consent lookup when the bot opted out of KVKK consent', async () => {
    customerBots.findUnique.mockResolvedValue({ kvkkConsentRequired: false });
    const result = await service.hasFreshKvkkConsent('bot-1', 'chat-1');
    expect(result).toEqual({ fresh: true });
    expect(leadPrivacyConsent.findFirst).not.toHaveBeenCalled();
  });
});

describe('LeadService — submit privacy-consent gate (Legal Slice 2)', () => {
  let service: LeadService;
  let prisma: {
    customerBots: { findUnique: jest.Mock };
    botLeads: { create: jest.Mock };
    teamMember: { findFirst: jest.Mock };
    leadPrivacyConsent: { findFirst: jest.Mock; update: jest.Mock };
  };
  let mail: { sendLeadNotification: jest.Mock };

  const botId = 'bot-1';
  const leadData = { name: 'Visitor', email: 'visitor@example.com' };

  // A bot with NO verification flags — before this gate, such a bot
  // captured PII with zero consent record (the Slice 2 gap).
  const plainBot = {
    id: botId,
    botName: 'Test Bot',
    teamId: 'team-1',
    leadDestinations: [{ channel: 'email', target: 'owner@example.com', enabled: true }],
    leadVerificationRequired: false,
    smsVerificationRequired: false,
    primaryLanguage: 'en',
  };

  beforeEach(async () => {
    process.env.LEAD_PRIVACY_CONSENT_GATE_ENABLED = 'true';
    prisma = {
      customerBots: { findUnique: jest.fn().mockResolvedValue(plainBot) },
      botLeads: { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
      teamMember: { findFirst: jest.fn() },
      leadPrivacyConsent: { findFirst: jest.fn(), update: jest.fn() },
    };
    mail = { sendLeadNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: JwtService, useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() } },
        { provide: SmsService, useValue: { sendOtpSms: jest.fn() } },
        { provide: LegalDocumentService, useValue: {} },
        {
          provide: ChatFlowService,
          useValue: { transition: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PushNotificationService, useValue: { sendToUsers: jest.fn() } },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();
    service = module.get(LeadService);
  });

  afterEach(() => {
    delete process.env.LEAD_PRIVACY_CONSENT_GATE_ENABLED;
  });

  it('rejects a no-verification bot when the chat has no consent row, and audits the rejection', async () => {
    prisma.leadPrivacyConsent.findFirst.mockResolvedValue(null);

    await expect(
      service.submit({ botId, chatId: 'chat-1', leadData }),
    ).rejects.toMatchObject({ response: { code: 'PRIVACY_CONSENT_REQUIRED' } });

    // Audit invariant: the rejected attempt is still visible in the inbox.
    expect(prisma.botLeads.create).toHaveBeenCalledTimes(1);
    const created = prisma.botLeads.create.mock.calls[0][0].data;
    expect(created.deliveryErrors).toEqual([
      { channel: 'none', error: 'privacy_consent_required' },
    ]);
    // No delivery was attempted for the rejected lead.
    expect(mail.sendLeadNotification).not.toHaveBeenCalled();
  });

  it('rejects when chatId is missing entirely (consent cannot be verified without a session)', async () => {
    await expect(
      service.submit({ botId, chatId: null, leadData }),
    ).rejects.toMatchObject({ response: { code: 'PRIVACY_CONSENT_REQUIRED' } });
    expect(prisma.leadPrivacyConsent.findFirst).not.toHaveBeenCalled();
  });

  it('gates BEFORE the email-verification check so the consent card comes first', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      ...plainBot,
      leadVerificationRequired: true,
    });
    prisma.leadPrivacyConsent.findFirst.mockResolvedValue(null);

    // No verificationToken given — without the gate this bot would have
    // thrown VERIFICATION_REQUIRED; consent must win the ordering.
    await expect(
      service.submit({ botId, chatId: 'chat-1', leadData }),
    ).rejects.toMatchObject({ response: { code: 'PRIVACY_CONSENT_REQUIRED' } });
  });

  it('writes the lead and links the consent row when consent exists', async () => {
    prisma.leadPrivacyConsent.findFirst.mockResolvedValue({ id: 'consent-1' });

    const result = await service.submit({ botId, chatId: 'chat-1', leadData });

    expect(result.status).toBe('delivered');
    const created = prisma.botLeads.create.mock.calls[0][0].data;
    expect(created.privacyConsentId).toBe('consent-1');
    expect(prisma.leadPrivacyConsent.update).toHaveBeenCalledWith({
      where: { id: 'consent-1' },
      data: { leadId: 'lead-1' },
    });
  });

  it('bypasses the gate for calendar-booking lead notifications (fire-and-forget after commit)', async () => {
    prisma.leadPrivacyConsent.findFirst.mockResolvedValue(null);

    const result = await service.submit({
      botId,
      chatId: 'chat-1',
      leadData: { ...leadData, source_bot: 'create_appointment' },
    });

    expect(result.status).toBe('delivered');
  });

  it('is a no-op when the flag is off (rollout safety: default behaviour unchanged)', async () => {
    delete process.env.LEAD_PRIVACY_CONSENT_GATE_ENABLED;

    const result = await service.submit({ botId, chatId: 'chat-1', leadData });

    expect(result.status).toBe('delivered');
    expect(prisma.leadPrivacyConsent.findFirst).not.toHaveBeenCalled();
  });
});
