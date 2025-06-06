import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "prisma/generated";
//import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
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