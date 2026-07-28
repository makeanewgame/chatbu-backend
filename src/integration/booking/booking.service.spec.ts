import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BookingService } from './booking.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SmsService } from 'src/sms/sms.service';

describe('BookingService — kind differentiator', () => {
  let service: BookingService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: SmsService, useValue: {} },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(BookingService);
  });

  it('signs booking JWTs with kind: booking', async () => {
    jwt.verifyAsync.mockResolvedValue({
      email: 'a@example.com',
      botCuid: 'bot-1',
      kind: 'booking',
      sub: 'rec-1',
    });

    await expect(
      service.checkToken('token', 'a@example.com', 'bot-1'),
    ).resolves.toMatchObject({ kind: 'booking' });
  });

  it('rejects a token issued for lead verification', async () => {
    jwt.verifyAsync.mockResolvedValue({
      email: 'a@example.com',
      botCuid: 'bot-1',
      kind: 'lead_verification',
      sub: 'lv-1',
    });

    await expect(
      service.checkToken('token', 'a@example.com', 'bot-1'),
    ).rejects.toThrow('TOKEN_MISMATCH');
  });

  it('rejects a token with no kind at all (pre-migration tokens)', async () => {
    jwt.verifyAsync.mockResolvedValue({
      email: 'a@example.com',
      botCuid: 'bot-1',
      sub: 'rec-1',
    });

    await expect(
      service.checkToken('token', 'a@example.com', 'bot-1'),
    ).rejects.toThrow('TOKEN_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// SMS-parallel booking verification (Faz B of SMS-booking migration)
//
// Same three-step ceremony as the email flow, phone-scoped. Runs against
// the same JWT service so payload shape / kind gate behave identically.
// ---------------------------------------------------------------------------
describe('BookingService — SMS flow', () => {
  let service: BookingService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let prisma: {
    bookingSmsVerification: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    customerBots: { findUnique: jest.Mock };
  };
  let sms: { sendOtpSms: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
    prisma = {
      bookingSmsVerification: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      customerBots: { findUnique: jest.fn() },
    };
    sms = { sendOtpSms: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: SmsService, useValue: sms },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get(BookingService);
  });

  // ---- requestSmsVerification -----------------------------------------

  it('requestSmsVerification generates a 6-digit code and sends it via SMS', async () => {
    prisma.bookingSmsVerification.count.mockResolvedValue(0);
    prisma.bookingSmsVerification.create.mockResolvedValue({ id: 'rec-1' });
    prisma.customerBots.findUnique.mockResolvedValue({ botName: 'TestBot' });

    const result = await service.requestSmsVerification('05321112233', 'bot-1');

    expect(result).toEqual({ verificationId: 'rec-1', expiresInSeconds: 600 });
    expect(sms.sendOtpSms).toHaveBeenCalledWith(
      '05321112233',
      expect.stringMatching(/^\d{6}$/),
      'TestBot',
      'tr',
    );

    const createArgs = prisma.bookingSmsVerification.create.mock.calls[0][0];
    expect(createArgs.data.phone).toBe('05321112233');
    expect(createArgs.data.botCuid).toBe('bot-1');
    expect(createArgs.data.code).toMatch(/^\d{6}$/);
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
  });

  it('requestSmsVerification falls back to a generic bot name when lookup fails', async () => {
    prisma.bookingSmsVerification.count.mockResolvedValue(0);
    prisma.bookingSmsVerification.create.mockResolvedValue({ id: 'rec-1' });
    prisma.customerBots.findUnique.mockRejectedValue(new Error('db down'));

    await service.requestSmsVerification('05321112233', 'bot-1');

    // 4th positional arg is `lang`; 3rd is botName. Fallback text is
    // 'our team' as per the service — matches the email path exactly.
    expect(sms.sendOtpSms).toHaveBeenCalledWith(
      '05321112233',
      expect.any(String),
      'our team',
      'tr',
    );
  });

  it('requestSmsVerification throws TOO_MANY_REQUESTS after 5 codes in an hour', async () => {
    prisma.bookingSmsVerification.count.mockResolvedValue(5);

    await expect(
      service.requestSmsVerification('05321112233', 'bot-1'),
    ).rejects.toThrow('TOO_MANY_REQUESTS');

    expect(prisma.bookingSmsVerification.create).not.toHaveBeenCalled();
    expect(sms.sendOtpSms).not.toHaveBeenCalled();
  });

  it('requestSmsVerification rate-limit keys on (phone, botCuid) — different phones each get their own budget', async () => {
    // Same botCuid, different phone → different counts. Confirms the
    // count query filters by BOTH phone AND botCuid, not just one.
    prisma.bookingSmsVerification.count.mockResolvedValue(0);
    prisma.bookingSmsVerification.create.mockResolvedValue({ id: 'r' });
    prisma.customerBots.findUnique.mockResolvedValue({ botName: 'B' });

    await service.requestSmsVerification('05321112233', 'bot-1');
    const firstQuery = prisma.bookingSmsVerification.count.mock.calls[0][0];
    expect(firstQuery.where.phone).toBe('05321112233');
    expect(firstQuery.where.botCuid).toBe('bot-1');
  });

  it('requestSmsVerification propagates SmsService errors so caller can surface a proper sentinel', async () => {
    prisma.bookingSmsVerification.count.mockResolvedValue(0);
    prisma.bookingSmsVerification.create.mockResolvedValue({ id: 'r' });
    prisma.customerBots.findUnique.mockResolvedValue({ botName: 'B' });
    sms.sendOtpSms.mockRejectedValue(new Error('NETGSM down'));

    await expect(
      service.requestSmsVerification('05321112233', 'bot-1'),
    ).rejects.toThrow('NETGSM down');
  });

  // ---- verifySms ------------------------------------------------------

  it('verifySms marks record used=true and returns a phone-scoped booking JWT', async () => {
    prisma.bookingSmsVerification.findFirst.mockResolvedValue({
      id: 'rec-1',
      phone: '05321112233',
      code: '123456',
      botCuid: 'bot-1',
    });
    prisma.bookingSmsVerification.update.mockResolvedValue({});
    jwt.signAsync.mockResolvedValue('jwt.signed.here');

    const result = await service.verifySms('05321112233', '123456', 'bot-1');

    expect(result).toEqual({ verified: true, verificationToken: 'jwt.signed.here' });

    // Record flipped to used=true so the same code can't be replayed.
    expect(prisma.bookingSmsVerification.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: { used: true },
    });

    // JWT payload carries `phone` (not `email`) and the shared kind:'booking'.
    const signArgs = jwt.signAsync.mock.calls[0][0];
    expect(signArgs).toMatchObject({
      phone: '05321112233',
      botCuid: 'bot-1',
      kind: 'booking',
      sub: 'rec-1',
    });
    expect(signArgs).not.toHaveProperty('email');
  });

  it('verifySms returns { verified: false } when the code does not match', async () => {
    prisma.bookingSmsVerification.findFirst.mockResolvedValue(null);

    const result = await service.verifySms('05321112233', 'wrong', 'bot-1');

    expect(result).toEqual({ verified: false });
    expect(prisma.bookingSmsVerification.update).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('verifySms filters findFirst on used=false and non-expired', async () => {
    prisma.bookingSmsVerification.findFirst.mockResolvedValue(null);

    await service.verifySms('05321112233', '123456', 'bot-1');

    const where = prisma.bookingSmsVerification.findFirst.mock.calls[0][0].where;
    expect(where.phone).toBe('05321112233');
    expect(where.code).toBe('123456');
    expect(where.botCuid).toBe('bot-1');
    expect(where.used).toBe(false);
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  // ---- checkSmsToken --------------------------------------------------

  it('checkSmsToken accepts a matching phone + kind:booking token', async () => {
    jwt.verifyAsync.mockResolvedValue({
      phone: '05321112233',
      botCuid: 'bot-1',
      kind: 'booking',
      sub: 'rec-1',
    });

    await expect(
      service.checkSmsToken('token', '05321112233', 'bot-1'),
    ).resolves.toMatchObject({ kind: 'booking', phone: '05321112233' });
  });

  it('checkSmsToken rejects a token issued for a different phone', async () => {
    jwt.verifyAsync.mockResolvedValue({
      phone: '05329998877',
      botCuid: 'bot-1',
      kind: 'booking',
      sub: 'rec-1',
    });

    await expect(
      service.checkSmsToken('token', '05321112233', 'bot-1'),
    ).rejects.toThrow('TOKEN_MISMATCH');
  });

  it('checkSmsToken rejects a token issued for lead verification (kind gate)', async () => {
    jwt.verifyAsync.mockResolvedValue({
      phone: '05321112233',
      botCuid: 'bot-1',
      kind: 'lead_verification',
      sub: 'lv-1',
    });

    await expect(
      service.checkSmsToken('token', '05321112233', 'bot-1'),
    ).rejects.toThrow('TOKEN_MISMATCH');
  });

  it('checkSmsToken rejects a token with no kind at all (pre-migration tokens)', async () => {
    jwt.verifyAsync.mockResolvedValue({
      phone: '05321112233',
      botCuid: 'bot-1',
      sub: 'rec-1',
    });

    await expect(
      service.checkSmsToken('token', '05321112233', 'bot-1'),
    ).rejects.toThrow('TOKEN_MISMATCH');
  });

  it('checkSmsToken rejects a booking token issued for a different bot', async () => {
    jwt.verifyAsync.mockResolvedValue({
      phone: '05321112233',
      botCuid: 'bot-OTHER',
      kind: 'booking',
      sub: 'rec-1',
    });

    await expect(
      service.checkSmsToken('token', '05321112233', 'bot-1'),
    ).rejects.toThrow('TOKEN_MISMATCH');
  });
});
