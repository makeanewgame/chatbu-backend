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
  ) { }

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
  async sendTeamInvitationMail(
    email: string,
    teamName: string,
    ownerName: string,
    invitationUrl: string,
    lang: string,
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'team-invitation.html' : 'team-invitation_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      teamName: teamName,
      ownerName: ownerName,
      invitationUrl: invitationUrl,
      company: process.env.COMPANY_NAME,
      company_address: process.env.COMPANY_ADDRESS,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
      end_subscription: process.env.FRONTEND_END_SUBSCRIPTION,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Team Invitation' : 'Takım Daveti',
      html: html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Team invitation mail sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendEmailVerificationMail(
    email: string,
    code: string,
    lang: string,
    fullname: string,
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
      company: 'Chatbu',
      company_address: '',
      redirect_url: process.env.FRONTEND_URL + '/activate-registration?email=' + email,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
      end_subscription: process.env.FRONTEND_END_SUBSCRIPTION,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Verify Your Email Address' : 'E-posta Adresinizi Doğrulayın',
      html: html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Email verification mail sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendTokenLimitReachedEmail(email: string, name: string) {
    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: 'Token Limit Reached - Upgrade to Premium',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Token Limit Reached</h2>
          <p>Dear ${name},</p>
          <p>Your token usage has reached its limit. To continue using our services, please upgrade to a Premium membership.</p>
          <p>Premium benefits include:</p>
          <ul>
            <li>Monthly token allocation</li>
            <li>Ability to purchase additional tokens</li>
            <li>Unlimited bots</li>
            <li>Priority support</li>
          </ul>
          <p><a href="${process.env.FRONTEND_URL}/subscription" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade Now</a></p>
          <p>Best regards,<br>Your Team</p>
        </div>
      `,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Token limit email sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendPaymentFailedEmail(email: string, name: string) {
    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: 'Payment Failed - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Failed</h2>
          <p>Dear ${name},</p>
          <p>We were unable to process your payment for your Premium subscription. Your account has been temporarily blocked.</p>
          <p>To restore access:</p>
          <ol>
            <li>Update your payment method</li>
            <li>Retry the payment</li>
          </ol>
          <p><a href="${process.env.FRONTEND_URL}/subscription" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Update Payment Method</a></p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br>Your Team</p>
        </div>
      `,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Payment failed email sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendPaymentReminderEmail(email: string, name: string, dueDate: Date) {
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: 'Upcoming Payment Reminder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Reminder</h2>
          <p>Dear ${name},</p>
          <p>This is a friendly reminder that your next payment is due on <strong>${formattedDate}</strong> (5 days from now).</p>
          <p>Please ensure your payment method is up to date to avoid any service interruption.</p>
          <p><a href="${process.env.FRONTEND_URL}/subscription" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Manage Subscription</a></p>
          <p>Best regards,<br>Your Team</p>
        </div>
      `,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Payment reminder email sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendNewFeedbackNotification(
    adminEmail: string,
    adminName: string,
    feedbackData: {
      userName: string;
      userEmail: string;
      category: string;
      message: string;
      feedbackId: string;
    },
    lang: string = 'en',
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'feedback_notification.html' : 'feedback_notification_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    // Format category for display
    const categoryMap = {
      'BUG_REPORT': lang === 'en' ? 'Bug Report' : 'Hata Bildirimi',
      'FEATURE_REQUEST': lang === 'en' ? 'Feature Request' : 'Özellik İsteği',
      'GENERAL_FEEDBACK': lang === 'en' ? 'General Feedback' : 'Genel Geri Bildirim',
    };

    const html = template({
      adminName: adminName,
      userName: feedbackData.userName,
      userEmail: feedbackData.userEmail,
      category: categoryMap[feedbackData.category] || feedbackData.category,
      message: feedbackData.message,
      createdAt: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'),
      adminPanelUrl: `${process.env.FRONTEND_URL}/admin/feedbacks`,
      company: process.env.COMPANY_NAME,
      privacyPolicyUrl: process.env.FRONTEND_PRIVACY_POLICY_URL,
      supportUrl: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: adminEmail,
      subject: lang === 'en'
        ? `New Feedback Received - ${categoryMap[feedbackData.category]}`
        : `Yeni Geri Bildirim - ${categoryMap[feedbackData.category]}`,
      html: html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Feedback notification sent to ${adminEmail}`);
    } catch (error) {
      this.logger.error(`Error sending feedback notification to ${adminEmail}:`, error);
      throw error;
    }
  }
}
