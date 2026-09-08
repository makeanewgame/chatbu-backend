/**
 * THROWAWAY dev-only helper: makes messaging integrations (WhatsApp / Messenger
 * / Instagram) appear "connected" for a given account WITHOUT going through the
 * real Meta OAuth flow, so the per-integration schedule UI can be tested end to
 * end before shipping.
 *
 * Every row it writes carries `config.__test: true`. Undo with:
 *   TARGET_EMAIL=helersu@yahoo.com REMOVE=1 npx tsx scripts/seed-test-integrations.ts
 *
 * The fake phoneNumberId / pageId / instagramAccountId values are unique test
 * strings, so real inbound webhooks never route to them.
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const TARGET_EMAIL = process.env.TARGET_EMAIL || 'helersu@yahoo.com';
const REMOVE = process.env.REMOVE === '1' || process.env.REMOVE === 'true';

const now = new Date().toISOString();

function configFor(type: string, botId: string): Record<string, unknown> {
    const base = { botId, status: 'connected', connectedAt: now, __test: true };
    if (type === 'whatsapp_embedded') {
        return {
            ...base,
            connectionType: 'embedded_signup',
            coexistence: false,
            wabaId: 'TEST_WABA_0000',
            phoneNumberId: 'TEST_PNID_0000',
            businessToken: 'TEST_TOKEN_wa',
            displayPhoneNumber: '+90 555 000 00 00',
            businessName: 'Test İşletme (WhatsApp)',
        };
    }
    if (type === 'metabusiness_embedded') {
        return {
            ...base,
            connectionType: 'embedded',
            pageId: 'TEST_PAGE_0000',
            pageName: 'Test Sayfa (Messenger)',
            pageAccessToken: 'TEST_TOKEN_fb',
            fbUserId: 'TEST_FBUSER_0000',
        };
    }
    // instagram_embedded
    return {
        ...base,
        connectionType: 'embedded',
        pageId: 'TEST_PAGE_0000',
        pageName: 'Test Sayfa (IG)',
        pageAccessToken: 'TEST_TOKEN_ig',
        instagramAccountId: 'TEST_IGID_0000',
        instagramUsername: 'test_ig_account',
    };
}

const TYPES = ['whatsapp_embedded', 'metabusiness_embedded', 'instagram_embedded'];

async function main() {
    const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
    if (!user) throw new Error(`No user with email ${TARGET_EMAIL}`);

    const teams = await prisma.team.findMany({
        where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
        select: { id: true, name: true, ownerId: true },
    });
    if (!teams.length) throw new Error(`User ${TARGET_EMAIL} has no team`);

    for (const team of teams) {
        const bots = await prisma.customerBots.findMany({
            where: { teamId: team.id, isDeleted: false },
            select: { id: true, botName: true },
        });

        console.log(
            `\nTeam ${team.id} (${team.name ?? 'unnamed'}${team.ownerId === user.id ? ', owner' : ', member'}) — ${bots.length} bot(s)`,
        );

        for (const bot of bots) {
            for (const type of TYPES) {
                const existing = await prisma.integrations.findFirst({
                    where: { teamId: team.id, type, botId: bot.id },
                });

                if (REMOVE) {
                    if (existing && (existing.config as any)?.__test) {
                        await prisma.integrations.delete({ where: { id: existing.id } });
                        console.log(`  - removed ${type} for bot "${bot.botName}"`);
                    }
                    continue;
                }

                if (existing) {
                    if ((existing.config as any)?.__test) {
                        await prisma.integrations.update({
                            where: { id: existing.id },
                            data: { config: configFor(type, bot.id) as any },
                        });
                        console.log(`  ~ refreshed ${type} for bot "${bot.botName}"`);
                    } else {
                        console.log(
                            `  ! skipped ${type} for bot "${bot.botName}" — a REAL integration already exists`,
                        );
                    }
                    continue;
                }

                await prisma.integrations.create({
                    data: {
                        teamId: team.id,
                        botId: bot.id,
                        type,
                        config: configFor(type, bot.id) as any,
                    },
                });
                console.log(`  + created ${type} for bot "${bot.botName}"`);
            }
        }
    }
}

main()
    .then(() => console.log('\nDone.'))
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
