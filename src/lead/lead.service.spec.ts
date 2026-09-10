import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { LeadService } from './lead.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SmsService } from 'src/sms/sms.service';
import { OtpChannelPreferenceService } from 'src/sms/otp-channel-preference.service';
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
        { provide: OtpChannelPreferenceService, useValue: { consumeForOtp: jest.fn().mockResolvedValue('sms'), peek: jest.fn().mockResolvedValue('sms'), hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false), set: jest.fn() } },
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
        { provide: OtpChannelPreferenceService, useValue: { consumeForOtp: jest.fn().mockResolvedValue('sms'), peek: jest.fn().mockResolvedValue('sms'), hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false), set: jest.fn() } },
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
        { provide: OtpChannelPreferenceService, useValue: { consumeForOtp: jest.fn().mockResolvedValue('sms'), peek: jest.fn().mockResolvedValue('sms'), hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false), set: jest.fn() } },
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

// ─── Legal Slice 6b (2026-09-07) ────────────────────────────────────────────
// The consent card's legal copy is CMS-first with a wholesale fallback to
// the hardcoded pack. These tests pin the two halves that matter for the
// audit trail: which text the visitor sees, and which version string the
// consent row will record — they must always come from the same source.
describe('LeadService — getConsentText (consent notice CMS-first)', () => {
  let service: LeadService;
  let getConsentNotice: jest.Mock;

  const build = async () => {
    const prisma: any = {
      customerBots: {
        findUnique: jest.fn().mockResolvedValue({ id: 'bot-1', teamId: 'team-1', settings: {} }),
      },
      team: { findUnique: jest.fn().mockResolvedValue({ businessName: 'Acme Ltd', name: 'Acme' }) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: (await import('src/sms/sms.service')).SmsService, useValue: {} },
        { provide: OtpChannelPreferenceService, useValue: { consumeForOtp: jest.fn().mockResolvedValue('sms'), peek: jest.fn().mockResolvedValue('sms'), hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false), set: jest.fn() } },
        { provide: LegalDocumentService, useValue: { getConsentNotice } },
        { provide: ChatFlowService, useValue: {} },
        { provide: PushNotificationService, useValue: {} },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();
    return module.get(LeadService);
  };

  beforeEach(() => {
    getConsentNotice = jest.fn().mockResolvedValue(null);
  });

  it('serves the hardcoded pack when no consent notice is published', async () => {
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'gdpr', explicitLocale: 'en' });

    expect(result.version).toBe('gdpr-en-v3');
    expect(result.intro).toContain('verification code');
  });

  it('serves the CMS notice and a version string derived from the published version', async () => {
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-gdpr',
      versionNumber: 2,
      locale: 'en',
      title: 'Updated Privacy Notice',
      intro: 'Counsel-approved intro.',
      controllerNotice: 'Processor line for {teamBusinessName}.',
      checkboxLabel: 'I accept.',
    });
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'gdpr', explicitLocale: 'en' });

    expect(result.version).toBe('privacy-notice-gdpr-v2');
    expect(result.title).toBe('Updated Privacy Notice');
    expect(result.intro).toBe('Counsel-approved intro.');
    expect(result.checkboxLabel).toBe('I accept.');
  });

  it('interpolates the team business name into a CMS-authored controller notice', async () => {
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-gdpr',
      versionNumber: 1,
      locale: 'en',
      title: 'Notice',
      intro: 'Intro.',
      controllerNotice: '{teamBusinessName} is the data controller.',
      checkboxLabel: 'I accept.',
    });
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'gdpr', explicitLocale: 'en' });

    expect(result.controllerNotice).toBe('Acme Ltd is the data controller.');
  });

  it('keeps UI chrome and legal URLs pack-owned even when the CMS serves the text', async () => {
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-gdpr',
      versionNumber: 1,
      locale: 'en',
      title: 'Notice',
      intro: 'Intro.',
      controllerNotice: 'Processor.',
      checkboxLabel: 'I accept.',
    });
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'gdpr', explicitLocale: 'en' });

    expect(result.continueButton).toBe('Accept and continue');
    expect(result.privacyPolicyUrl).toContain('/privacy-policy');
    expect(result.termsOfUseUrl).toContain('/terms-of-service');
  });

  it('resolves UI chrome against the SERVED locale, not the requested one', async () => {
    // Requested 'de', but the CMS has no approved German translation and
    // falls back to its English source — the buttons must follow the text.
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-gdpr',
      versionNumber: 3,
      locale: 'en',
      title: 'Notice',
      intro: 'Intro.',
      controllerNotice: 'Processor.',
      checkboxLabel: 'I accept.',
    });
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'gdpr', explicitLocale: 'de' });

    expect(result.locale).toBe('en');
    expect(result.continueButton).toBe('Accept and continue');
  });

  it('pairs a CMS translation with chrome in the SAME language, whatever the jurisdiction', async () => {
    // The real half-translated card: Accept-Language en-US put a Turkish
    // speaker under CCPA, and there is no ccpa:tr pack — so the notice went
    // out fully English inside a Turkish widget. With a tr translation in
    // the CMS, the buttons must follow the text into Turkish.
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-ccpa',
      versionId: 'ver-1',
      versionNumber: 1,
      locale: 'tr',
      title: 'Aydınlatma Metni',
      intro: 'Türkçe giriş.',
      controllerNotice: '{teamBusinessName} veri sorumlusudur.',
      checkboxLabel: 'Okudum, kabul ediyorum.',
    });
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'ccpa', explicitLocale: 'tr' });

    expect(result.locale).toBe('tr');
    expect(result.continueButton).not.toBe('Accept and continue');
    expect(result.privacyPolicyUrl).toContain('lng=tr');
  });

  it('falls back to the pack — text AND version together — when the CMS lookup throws', async () => {
    getConsentNotice.mockRejectedValue(new Error('db down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    service = await build();

    const result = await service.getConsentText('bot-1', { explicitJurisdiction: 'kvkk', explicitLocale: 'tr' });

    expect(result.version).toBe('kvkk-tr-v3');
    expect(result.title).toBe('Aydınlatma Metni ve Kullanım Şartları');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─── 2026-09-07: the consent WRITE path ────────────────────────────────────
// recordPrivacyConsent used to run its own lookup against a slug scheme
// (`privacy-<jurisdiction>`) that was never seeded, so it always recorded
// the pack version — even for visitors who had just been shown CMS text.
// Read and write must resolve identically or the audit trail describes a
// different document than the one on screen.
describe('LeadService — recordPrivacyConsent (audit version)', () => {
  let service: LeadService;
  let getConsentNotice: jest.Mock;
  let create: jest.Mock;

  const build = async () => {
    create = jest.fn().mockImplementation(({ data }: any) => ({ id: 'consent-1', ...data }));
    const prisma: any = {
      customerBots: { findUnique: jest.fn().mockResolvedValue({ id: 'bot-1', teamId: 'team-1', settings: {} }) },
      leadPrivacyConsent: { create },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: (await import('src/sms/sms.service')).SmsService, useValue: {} },
        { provide: OtpChannelPreferenceService, useValue: { consumeForOtp: jest.fn().mockResolvedValue('sms'), peek: jest.fn().mockResolvedValue('sms'), hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false), set: jest.fn() } },
        { provide: LegalDocumentService, useValue: { getConsentNotice } },
        { provide: ChatFlowService, useValue: { transition: jest.fn() } },
        { provide: PushNotificationService, useValue: {} },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();
    return module.get(LeadService);
  };

  beforeEach(() => {
    getConsentNotice = jest.fn().mockResolvedValue(null);
  });

  it('records the CMS version string and links the version row', async () => {
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-ccpa',
      versionId: 'ver-9',
      versionNumber: 1,
      locale: 'en',
      title: 'Notice',
      intro: 'i',
      controllerNotice: 'c',
      checkboxLabel: 'k',
    });
    service = await build();

    const result = await service.recordPrivacyConsent(
      { botId: 'bot-1', jurisdiction: 'ccpa', locale: 'en' } as any,
      null,
      null,
      'en-US',
    );

    expect(result.privacyVersion).toBe('privacy-notice-ccpa-v1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          privacyVersion: 'privacy-notice-ccpa-v1',
          legalDocumentVersionId: 'ver-9',
        }),
      }),
    );
  });

  it('records the SERVED locale, not the requested one', async () => {
    // Visitor asked for Turkish; the CMS had no approved tr translation and
    // served its English source. Recording 'tr' would claim they read a
    // Turkish notice.
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-ccpa',
      versionId: 'ver-9',
      versionNumber: 1,
      locale: 'en',
      title: 'Notice',
      intro: 'i',
      controllerNotice: 'c',
      checkboxLabel: 'k',
    });
    service = await build();

    const result = await service.recordPrivacyConsent(
      { botId: 'bot-1', jurisdiction: 'ccpa', locale: 'tr' } as any,
      null,
      null,
      'tr-TR',
    );

    expect(result.locale).toBe('en');
  });

  it('falls back to the pack version when no notice is published', async () => {
    service = await build();

    const result = await service.recordPrivacyConsent(
      { botId: 'bot-1', jurisdiction: 'gdpr', locale: 'de' } as any,
      null,
      null,
      'de-DE',
    );

    expect(result.privacyVersion).toBe('gdpr-de-v3');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ legalDocumentVersionId: null }) }),
    );
  });

  it('never records a bare version number — the string must name the document', async () => {
    getConsentNotice.mockResolvedValue({
      slug: 'privacy-notice-kvkk',
      versionId: 'ver-2',
      versionNumber: 3,
      locale: 'tr',
      title: 'x',
      intro: 'i',
      controllerNotice: 'c',
      checkboxLabel: 'k',
    });
    service = await build();

    const result = await service.recordPrivacyConsent(
      { botId: 'bot-1', jurisdiction: 'kvkk' } as any,
      null,
      null,
      'tr-TR',
    );

    expect(result.privacyVersion).toBe('privacy-notice-kvkk-v3');
    expect(result.privacyVersion).not.toMatch(/^v\d+$/);
  });
});


describe('LeadService — requestSmsVerification cross-flow OTP guard', () => {
  let service: LeadService;
  let prisma: any;
  let sms: { sendOtpSms: jest.Mock };
  let otpChannel: { consumeForOtp: jest.Mock; peek: jest.Mock; hasSpentWhatsAppChoice: jest.Mock; set: jest.Mock };
  let chatFlow: {
    getVerifiedPhoneForChat: jest.Mock;
    getPendingOtpFlowForChat: jest.Mock;
    transition: jest.Mock;
  };

  const botId = 'bot-1';
  const chatId = 'chat-1';
  const phone = '+90 538 645 05 82';

  beforeEach(async () => {
    prisma = {
      customerBots: {
        findUnique: jest.fn().mockResolvedValue({
          id: botId,
          botName: 'TestBot',
          smsVerificationRequired: true,
          kvkkConsentRequired: false,
        }),
      },
      leadPrivacyConsent: { findFirst: jest.fn(), update: jest.fn() },
      leadSmsVerification: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'v-1' }),
      },
    };
    sms = { sendOtpSms: jest.fn().mockResolvedValue(undefined) };
    otpChannel = {
      consumeForOtp: jest.fn().mockResolvedValue('sms'),
      peek: jest.fn().mockResolvedValue('sms'),
      hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false),
      set: jest.fn(),
    };
    chatFlow = {
      getVerifiedPhoneForChat: jest.fn().mockResolvedValue(null),
      getPendingOtpFlowForChat: jest.fn().mockResolvedValue(null),
      transition: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: SmsService, useValue: sms },
        { provide: OtpChannelPreferenceService, useValue: otpChannel },
        { provide: LegalDocumentService, useValue: {} },
        { provide: ChatFlowService, useValue: chatFlow },
        { provide: PushNotificationService, useValue: {} },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();
    service = module.get(LeadService);
  });

  it('stands down when the booking flow already has a code in flight to the same number', async () => {
    const sentAt = new Date();
    chatFlow.getPendingOtpFlowForChat.mockResolvedValue({ flowKind: 'BOOKING', sentAt });

    const result = await service.requestSmsVerification({ botId, chatId, phone });

    expect(result).toEqual({ status: 'pending_other_flow', flow: 'BOOKING' });
    // The whole point: no second code exists, so the visitor cannot be
    // handed two codes that verify against two different tables.
    expect(sms.sendOtpSms).not.toHaveBeenCalled();
    expect(prisma.leadSmsVerification.create).not.toHaveBeenCalled();
  });

  it('only defers to BOOKING — never lets a lead code suppress a booking one', async () => {
    await service.requestSmsVerification({ botId, chatId, phone });
    const call = chatFlow.getPendingOtpFlowForChat.mock.calls[0][0];
    expect(call.flowKinds).toEqual(['BOOKING']);
    expect(call.targetPhone).toBe(phone);
    expect(call.chatId).toBe(chatId);
  });

  it('sends normally when no other flow is waiting', async () => {
    const result = await service.requestSmsVerification({ botId, chatId, phone });

    expect(result).toMatchObject({ status: 'sent' });
    expect(sms.sendOtpSms).toHaveBeenCalledTimes(1);
  });

  it('lets the SMS rescue through the resend cooldown when WhatsApp already failed', async () => {
    prisma.leadSmsVerification.findFirst.mockResolvedValue({
      id: 'v-0',
      createdAt: new Date(Date.now() - 15 * 1000), // inside the 60s cooldown
    });
    otpChannel.hasSpentWhatsAppChoice.mockResolvedValue(true);
    otpChannel.consumeForOtp.mockResolvedValue('sms');

    const result = await service.requestSmsVerification({ botId, chatId, phone });

    expect(result).toMatchObject({ status: 'sent' });
    expect(sms.sendOtpSms).toHaveBeenCalledTimes(1);
  });

  it('still rate-limits when the channel is not changing', async () => {
    prisma.leadSmsVerification.findFirst.mockResolvedValue({
      id: 'v-0',
      createdAt: new Date(Date.now() - 15 * 1000),
    });
    otpChannel.hasSpentWhatsAppChoice.mockResolvedValue(false);

    const result = await service.requestSmsVerification({ botId, chatId, phone });

    expect(result).toEqual({ status: 'rate_limited' });
    expect(sms.sendOtpSms).not.toHaveBeenCalled();
  });

  it('skips the guard entirely without a chatId (the guard is chat-scoped)', async () => {
    await service.requestSmsVerification({ botId, chatId: '', phone });
    expect(chatFlow.getPendingOtpFlowForChat).not.toHaveBeenCalled();
    expect(sms.sendOtpSms).toHaveBeenCalledTimes(1);
  });
});

// The consent gate must not depend on the agent remembering to pass
// `source_channel`. When it goes missing on a DM channel, the gate
// answers KVKK_CONSENT_REQUIRED — a sentinel naming two tools the Meta
// tool filter has already stripped, so nothing the agent can call clears
// it. Prod GÜNSA (Instagram DM, 2026-09-05) is what that looks like from
// the visitor's side one gate earlier in the same chain: three "your
// details were saved" replies and no lead row at all.
describe('LeadService — off-widget consent fallback (chatId-derived channel)', () => {
  const botId = 'bot-1';
  const phone = '+90 538 858 88 89';

  const buildModule = async (overrides: {
    bot: Record<string, unknown>;
    prismaExtra?: Record<string, unknown>;
  }) => {
    const prisma: any = {
      customerBots: { findUnique: jest.fn().mockResolvedValue(overrides.bot) },
      botLeads: { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
      teamMember: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      team: { findUnique: jest.fn().mockResolvedValue({ ownerId: 'owner-1' }) },
      leadPrivacyConsent: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'consent-1',
          privacyVersion: 'pack-v1',
          jurisdiction: 'kvkk',
          locale: 'tr',
        }),
      },
      leadSmsVerification: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'v-1' }),
      },
      ...(overrides.prismaExtra || {}),
    };
    const sms = { sendOtpSms: jest.fn().mockResolvedValue(undefined) };
    const mail = { sendLeadNotification: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: JwtService, useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() } },
        { provide: SmsService, useValue: sms },
        {
          provide: OtpChannelPreferenceService,
          useValue: {
            consumeForOtp: jest.fn().mockResolvedValue('sms'),
            peek: jest.fn().mockResolvedValue('sms'),
            hasSpentWhatsAppChoice: jest.fn().mockResolvedValue(false),
            set: jest.fn(),
          },
        },
        {
          provide: LegalDocumentService,
          // Not seeded in any environment yet — the null answer is the
          // expected state and recordPrivacyConsent falls back to the pack.
          useValue: { getConsentNotice: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: ChatFlowService,
          useValue: {
            transition: jest.fn().mockResolvedValue(undefined),
            getVerifiedPhoneForChat: jest.fn().mockResolvedValue(null),
            getPendingOtpFlowForChat: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: PushNotificationService, useValue: { sendToUsers: jest.fn() } },
        { provide: MixpanelService, useValue: mixpanelStub },
      ],
    }).compile();
    return { service: module.get(LeadService), prisma, sms, mail };
  };

  const smsBot = {
    id: botId,
    botName: 'GunsaLike',
    teamId: 'team-1',
    smsVerificationRequired: true,
    kvkkConsentRequired: true,
  };

  const plainBot = {
    id: botId,
    botName: 'GunsaLike',
    teamId: 'team-1',
    leadDestinations: [{ channel: 'email', target: 'owner@example.com', enabled: true }],
    leadVerificationRequired: false,
    smsVerificationRequired: false,
    primaryLanguage: 'tr',
  };

  describe('requestSmsVerification', () => {
    it('records consent itself on an Instagram chat and sends the code', async () => {
      const { service, prisma, sms } = await buildModule({ bot: smsBot });

      const result = await service.requestSmsVerification({
        botId,
        chatId: 'ig_1128825063142264_1788609920677',
        phone,
        lang: 'tr',
      });

      expect(result).toMatchObject({ status: 'sent' });
      expect(sms.sendOtpSms).toHaveBeenCalledTimes(1);
      // Written on the agent's behalf, and labelled so it is never
      // mistaken for a visitor who tapped the widget's consent card.
      expect(prisma.leadPrivacyConsent.create).toHaveBeenCalledTimes(1);
      expect(prisma.leadPrivacyConsent.create.mock.calls[0][0].data).toMatchObject({
        botId,
        chatId: 'ig_1128825063142264_1788609920677',
        source: 'chatbot_instagram',
      });
    });

    it.each([['fb_thread-9'], ['wa_905388588889']])(
      'covers %s too — every DM channel lacks the card',
      async (chatId) => {
        const { service, sms } = await buildModule({ bot: smsBot });
        await expect(
          service.requestSmsVerification({ botId, chatId, phone }),
        ).resolves.toMatchObject({ status: 'sent' });
        expect(sms.sendOtpSms).toHaveBeenCalledTimes(1);
      },
    );

    it('still demands the card on a widget chat', async () => {
      const { service, prisma, sms } = await buildModule({ bot: smsBot });

      await expect(
        service.requestSmsVerification({ botId, chatId: 'sid_web-1', phone }),
      ).rejects.toMatchObject({
        response: { code: 'KVKK_CONSENT_REQUIRED' },
      });
      expect(prisma.leadPrivacyConsent.create).not.toHaveBeenCalled();
      expect(sms.sendOtpSms).not.toHaveBeenCalled();
    });

    it('fails closed when the consent write itself fails', async () => {
      const { service, sms, prisma } = await buildModule({ bot: smsBot });
      prisma.leadPrivacyConsent.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.requestSmsVerification({ botId, chatId: 'ig_thread-1', phone }),
      ).rejects.toMatchObject({
        response: { code: 'KVKK_CONSENT_REQUIRED' },
      });
      // A missing consent row is never treated as consent.
      expect(sms.sendOtpSms).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      process.env.LEAD_PRIVACY_CONSENT_GATE_ENABLED = 'true';
    });
    afterEach(() => {
      delete process.env.LEAD_PRIVACY_CONSENT_GATE_ENABLED;
    });

    it('lets an Instagram lead through by recording consent instead of rejecting', async () => {
      const { service, prisma } = await buildModule({ bot: plainBot });

      await service.submit({
        botId,
        chatId: 'ig_thread-1',
        leadData: { name: 'Recep', phone: '05388588889' },
      } as any);

      expect(prisma.leadPrivacyConsent.create).toHaveBeenCalledTimes(1);
      // A real lead row, not the rejection audit row (which carries
      // deliveryErrors [{channel:'none', error:'privacy_consent_required'}]
      // and no consent id).
      const created = prisma.botLeads.create.mock.calls[0][0].data;
      expect(created.deliveryErrors).not.toEqual([
        { channel: 'none', error: 'privacy_consent_required' },
      ]);
      expect(created.privacyConsentId).toBe('consent-1');
    });

    it('still rejects a widget lead with no consent row', async () => {
      const { service, prisma } = await buildModule({ bot: plainBot });

      await expect(
        service.submit({
          botId,
          chatId: 'sid_web-1',
          leadData: { name: 'Recep', phone: '05388588889' },
        } as any),
      ).rejects.toMatchObject({
        response: { code: 'PRIVACY_CONSENT_REQUIRED' },
      });
      expect(prisma.leadPrivacyConsent.create).not.toHaveBeenCalled();
    });
  });
});
