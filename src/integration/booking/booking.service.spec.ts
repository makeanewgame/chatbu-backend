import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BookingService } from './booking.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

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
