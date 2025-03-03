import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { DrizzleDB } from 'src/drizzle/types/drizzle';
import * as schema from 'src/drizzle/schema/schema';
import { eq } from 'drizzle-orm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class AuthenticationService {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @Inject(DRIZZLE) private readonly db: DrizzleDB) { }

    async register(user: typeof schema.users.$inferInsert) {

        console.log("user", user)
        user.refreshtoken = "";
        user.updated_at = new Date().toISOString();


        const findUser = await this.db.query.users.findFirst({
            where: eq(schema.users.email, user.email)
        });

        //Kullanıcı daha önce kayıt olmuş ise onu login sayfasına şifresini girecek bir şekilde yönlendir.

        if (findUser) {
            return false;
        } else {

            const bcrypt = require('bcrypt');
            user.password = await bcrypt.hash(user.password, 10);


            await this.db.insert(schema.users).values(user);
            this.logger.info('Registering user', user.email);
        }

        return true;

    }

    async logout(email: string) {
        // Check schema to use the correct field name instead of 'refreshToken'
        // For example, if you have a 'token' field:
        await this.db.update(schema.users).set({
            refreshtoken: ''
        }).where(eq(schema.users.email, email));
    }

}
