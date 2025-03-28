import { Inject, Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async sendRegisterMail(
    email: string,
    code: string,
    lang: string,
    fullname: string,
    company: string,
    company_address: string,
    redirect_url: string,
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'register.html' : 'register_tr.html',
    );
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
      this.logger.info(`Activation mail sent to ${email}`);
    } catch (error) {
      console.error(error);
    }
  }
  async sendActivateLostPasswordMail(
    email: string,
    code: string,
    lang: string,
    redirect_url: string,
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'forgot-password.html' : 'forgot-password_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      code: code,

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
      this.logger.info(`Activation mail sent to ${email}`);
    } catch (error) {
      console.error(error);
    }
  }
  async sendPasswordChangedMail(email: string, code: string, lang: string) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en'
        ? 'password-change-success.html'
        : 'password-change-success_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      code: code,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
      end_subscription: process.env.FRONTEND_END_SUBSCRIPTION,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Password changed' : 'Şifre değiştirildi',
      html: html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Password reset mail sent to ${email}`);
    } catch (error) {
      console.error(error);
    }
  }
}
