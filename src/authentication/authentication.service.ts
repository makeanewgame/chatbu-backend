import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { DrizzleDB } from 'src/drizzle/types/drizzle';
import * as schema from 'src/drizzle/schema/schema';
import { eq } from 'drizzle-orm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthenticationService {
    constructor(
        private mail: MailService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

            //create temp code 6 digits
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await this.cacheManager.set(user.email, code, 60 * 60 * 24);
            await this.db.insert(schema.users).values(user);

            const activationUrl = process.env.FRONTEND_URL + '/activate-registration?email=' + user.email;

            const company = process.env.COMPANY_NAME;
            const company_address = process.env.COMPANY_ADDRESS;

            console.log("company", company)
            console.log("company_address", company_address)
            console.log("activationUrl", activationUrl)
            console.log("code", code)

            this.mail.sendRegisterMail(user.email, code, 'en', user.name, company, company_address, activationUrl);

            this.logger.info('Registering user', user.email);
        }

        return true;

    }

    async activateRegistration(email: string, code: string) {
        const cachedCode = await this.cacheManager.get(email);
        if (cachedCode === code) {

            await this.db.update(schema.users).set({

            }).where(eq(schema.users.email, email));
            return true;
        }
        return false;
    }

    async logout(email: string) {
        // Check schema to use the correct field name instead of 'refreshToken'
        // For example, if you have a 'token' field:
        await this.db.update(schema.users).set({
            refreshtoken: ''
        }).where(eq(schema.users.email, email));
    }

}
