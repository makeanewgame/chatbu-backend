import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class MailService {
    constructor(
        private readonly mailerService: MailerService
    ) { }

    async sendRegisterMail(
        email: string,
        code: string,
        lang: string,
        fullname: string,
        company: string,
        company_address: string,
        redirect_url: string
    ) {

        const rootDir = process.cwd();

        const templatePath = path.join(rootDir, 'dist', 'templates', 'register.html');
        console.log('rootDir', rootDir);
        console.log('templatePath', templatePath);
        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateSource);
        const html = template({
            fullname: fullname,
            code: code,
            company: company,
            company_address: company_address,
            redirect_url: redirect_url,
            privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
            support_url: process.env.FRONTEND_SUPPORT_URL,
            end_subscription: process.env.FRONTEND_END_SUBSCRIPTION,
        });

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: email,
            subject: 'Activate your account',
            html: html,
        };

        try {
            await this.mailerService.sendMail(mailOptions);
            console.log('Email sent successfully');
        }
        catch (error) {
            console.error(error);
        }
    }
}
