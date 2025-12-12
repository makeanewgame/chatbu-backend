import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    constructor() {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        super({ adapter });
    }

    onModuleInit() {
        this.$connect()
            .then(() => {
                console.log("Connected to Prisma Client");
            })
            .catch((e) => {
                console.error("Error connecting on db", e);
            });
    }
}