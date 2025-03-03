import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
export const DRIZZLE = Symbol("drizzle-connection");

import * as schema from './schema/schema';

@Module({
    providers: [
        {
            provide: DRIZZLE,
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const databaseURL = configService.get<string>('DATABASE_URL');

                const pool = new Pool({
                    connectionString: databaseURL,
                    ssl: false
                });

                return drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;

            },
        },
    ],
    exports: [DRIZZLE]
})
export class DrizzleModule { }
