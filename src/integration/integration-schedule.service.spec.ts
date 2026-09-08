import { DateTime } from 'luxon';
import { IntegrationScheduleService } from './integration-schedule.service';
import { IntegrationSchedule } from './integration-schedule.constants';
import { WorkingHours } from 'src/appointment/appointment.constants';

// Mon–Fri 09:00–18:00 Europe/Istanbul, weekend closed.
const BUSINESS_HOURS: WorkingHours = {
    timezone: 'Europe/Istanbul',
    slotMinutes: 30,
    days: {
        mon: { enabled: true, start: '09:00', end: '18:00' },
        tue: { enabled: true, start: '09:00', end: '18:00' },
        wed: { enabled: true, start: '09:00', end: '18:00' },
        thu: { enabled: true, start: '09:00', end: '18:00' },
        fri: { enabled: true, start: '09:00', end: '18:00' },
        sat: { enabled: false, start: '09:00', end: '18:00' },
        sun: { enabled: false, start: '09:00', end: '18:00' },
    },
};

// Fixed reference instants (all Europe/Istanbul local wall-clock):
//  - WED_1000  Wednesday 2026-09-09 10:00  → business hours, weekday
//  - WED_2100  Wednesday 2026-09-09 21:00  → after hours, weeknight
//  - SAT_1300  Saturday  2026-09-12 13:00  → weekend, daytime
//  - SUN_0300  Sunday    2026-09-13 03:00  → weekend, deep night
const at = (iso: string) => DateTime.fromISO(iso, { zone: 'Europe/Istanbul' });
const WED_1000 = at('2026-09-09T10:00');
const WED_2100 = at('2026-09-09T21:00');
const WED_2300 = at('2026-09-09T23:00');
const SAT_1300 = at('2026-09-12T13:00');
const SUN_0300 = at('2026-09-13T03:00');

describe('IntegrationScheduleService.isIntegrationActive', () => {
    let service: IntegrationScheduleService;

    beforeEach(() => {
        const prisma = {
            customerBots: {
                findUnique: jest.fn().mockResolvedValue({
                    appointmentWorkingHours: BUSINESS_HOURS,
                }),
            },
        };
        service = new IntegrationScheduleService(prisma as any);
    });

    const integ = (schedule: IntegrationSchedule | null) => ({
        id: 'int_1',
        botId: 'bot_1',
        schedule,
    });

    it('NULL schedule → always active (no DB read)', async () => {
        const prisma = { customerBots: { findUnique: jest.fn() } };
        const s = new IntegrationScheduleService(prisma as any);
        await expect(s.isIntegrationActive(integ(null), WED_2100)).resolves.toBe(true);
        expect(prisma.customerBots.findUnique).not.toHaveBeenCalled();
    });

    it('mode "always" → active even at 3am on a weekend', async () => {
        await expect(
            service.isIntegrationActive(integ({ mode: 'always' }), SUN_0300),
        ).resolves.toBe(true);
    });

    it('mode "off" → never active', async () => {
        await expect(
            service.isIntegrationActive(integ({ mode: 'off' }), WED_1000),
        ).resolves.toBe(false);
    });

    it('mode "business_hours" → active inside window, silent outside', async () => {
        await expect(
            service.isIntegrationActive(integ({ mode: 'business_hours' }), WED_1000),
        ).resolves.toBe(true);
        await expect(
            service.isIntegrationActive(integ({ mode: 'business_hours' }), WED_2100),
        ).resolves.toBe(false);
        await expect(
            service.isIntegrationActive(integ({ mode: 'business_hours' }), SAT_1300),
        ).resolves.toBe(false); // sat disabled
    });

    it('mode "outside_business_hours" → inverse of business_hours', async () => {
        await expect(
            service.isIntegrationActive(integ({ mode: 'outside_business_hours' }), WED_1000),
        ).resolves.toBe(false);
        await expect(
            service.isIntegrationActive(integ({ mode: 'outside_business_hours' }), WED_2100),
        ).resolves.toBe(true);
        await expect(
            service.isIntegrationActive(integ({ mode: 'outside_business_hours' }), SAT_1300),
        ).resolves.toBe(true);
    });

    it('mode "weekends" → active Sat/Sun only', async () => {
        await expect(
            service.isIntegrationActive(integ({ mode: 'weekends' }), SAT_1300),
        ).resolves.toBe(true);
        await expect(
            service.isIntegrationActive(integ({ mode: 'weekends' }), SUN_0300),
        ).resolves.toBe(true);
        await expect(
            service.isIntegrationActive(integ({ mode: 'weekends' }), WED_1000),
        ).resolves.toBe(false);
    });

    it('mode "nights" → active 20:00–08:00, silent during the day (overnight window)', async () => {
        await expect(
            service.isIntegrationActive(integ({ mode: 'nights' }), WED_2100),
        ).resolves.toBe(true);
        await expect(
            service.isIntegrationActive(integ({ mode: 'nights' }), SUN_0300),
        ).resolves.toBe(true);
        await expect(
            service.isIntegrationActive(integ({ mode: 'nights' }), WED_1000),
        ).resolves.toBe(false);
        await expect(
            service.isIntegrationActive(integ({ mode: 'nights' }), SAT_1300),
        ).resolves.toBe(false);
    });

    it('mode "custom" → honours a per-day overnight window', async () => {
        const custom: IntegrationSchedule = {
            mode: 'custom',
            timezone: 'Europe/Istanbul',
            days: {
                mon: { enabled: false, start: '00:00', end: '00:00' },
                tue: { enabled: false, start: '00:00', end: '00:00' },
                wed: { enabled: true, start: '22:00', end: '06:00' }, // overnight
                thu: { enabled: true, start: '22:00', end: '06:00' },
                fri: { enabled: false, start: '00:00', end: '00:00' },
                sat: { enabled: false, start: '00:00', end: '00:00' },
                sun: { enabled: true, start: '00:00', end: '06:00' },
            },
        };
        await expect(service.isIntegrationActive(integ(custom), WED_2300)).resolves.toBe(true);
        await expect(service.isIntegrationActive(integ(custom), WED_2100)).resolves.toBe(false); // before 22:00
        await expect(service.isIntegrationActive(integ(custom), WED_1000)).resolves.toBe(false);
        await expect(service.isIntegrationActive(integ(custom), SUN_0300)).resolves.toBe(true);
    });

    it('custom schedule with an explicit timezone shifts the window', async () => {
        const custom: IntegrationSchedule = {
            mode: 'custom',
            timezone: 'America/New_York', // UTC-4 in September → 7h behind Istanbul
            days: {
                mon: { enabled: true, start: '09:00', end: '18:00' },
                tue: { enabled: true, start: '09:00', end: '18:00' },
                wed: { enabled: true, start: '09:00', end: '18:00' },
                thu: { enabled: true, start: '09:00', end: '18:00' },
                fri: { enabled: true, start: '09:00', end: '18:00' },
                sat: { enabled: true, start: '09:00', end: '18:00' },
                sun: { enabled: true, start: '09:00', end: '18:00' },
            },
        };
        // WED_1000 Istanbul == 03:00 New York → outside 09:00–18:00.
        await expect(service.isIntegrationActive(integ(custom), WED_1000)).resolves.toBe(false);
        // WED_2100 Istanbul == 14:00 New York → inside.
        await expect(service.isIntegrationActive(integ(custom), WED_2100)).resolves.toBe(true);
    });

    it('degrades OPEN when the bot lookup throws', async () => {
        const prisma = {
            customerBots: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) },
        };
        const s = new IntegrationScheduleService(prisma as any);
        await expect(
            s.isIntegrationActive(integ({ mode: 'business_hours' }), WED_2100),
        ).resolves.toBe(true);
    });
});
