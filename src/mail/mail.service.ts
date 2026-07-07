import { Inject, Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

// This service is responsible for sending all types of emails in the system, including registration, password reset, team invitations, and booking verifications. It uses Handlebars templates for email content and supports multiple languages (English and Turkish). Also includes methods for sending notifications about token limits and payment issues. Language is determined by the caller and defaults to English if not specified. All email sending operations are logged for monitoring and debugging purposes.

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
      subject: lang === 'en' ? 'Activate your account' : 'Hesabınızı Aktifleştirin',
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
      subject: lang === 'en' ? 'Reset your password' : 'Şifrenizi sıfırlayın',
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

    console.log('Sending password changed mail with code:', code, 'to email:', email, 'in language:', lang);

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
      subject: lang === 'en' ? 'Chatbu Team Invitation' : 'Chatbu Takım Daveti',
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

  async sendBookingVerificationMail(
    email: string,
    code: string,
    botName: string,
    lang: string,
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'booking-verification.html' : 'booking-verification_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      code,
      botName: botName || (lang === 'en' ? 'our team' : 'ekibimiz'),
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? `Verify your appointment with ${botName || 'our team'}` : `${botName || 'Ekibimiz'} ile randevunuzu doğrulayın`,
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Booking verification mail sent to ${email}`);
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

  async sendTokenLimitReachedEmail(email: string, name: string, lang: string = 'en') {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'token-limit-reached.html' : 'token-limit-reached_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      name,
      frontend_url: process.env.FRONTEND_URL,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Token Limit Reached - Upgrade to Premium' : 'Token Limitiniz Doldu - Premium\'e Geçin',
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Token limit email sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendPaymentFailedEmail(email: string, name: string, lang: string = 'en') {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'payment-failed.html' : 'payment-failed_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      name,
      frontend_url: process.env.FRONTEND_URL,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Payment Failed - Action Required' : 'Ödeme Başarısız - İşlem Gerekiyor',
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Payment failed email sent to ${email}`);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendPaymentReminderEmail(email: string, name: string, dueDate: Date, lang: string = 'en') {
    const formattedDate = dueDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'payment-reminder.html' : 'payment-reminder_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template({
      name,
      formattedDate,
      frontend_url: process.env.FRONTEND_URL,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject: lang === 'en' ? 'Upcoming Payment Reminder' : 'Yaklaşan Ödeme Hatırlatması',
      html,
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

  async sendLeadNotification(
    to: string,
    botName: string,
    leadData: { name?: string; email?: string; phone?: string; notes?: string },
    lang: string = 'en',
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'lead_notification.html' : 'lead_notification_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    const html = template({
      botName,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      notes: leadData.notes,
      createdAt: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'),
      leadsInboxUrl: `${process.env.FRONTEND_URL}/leads`,
      company: process.env.COMPANY_NAME,
      privacyPolicyUrl: process.env.FRONTEND_PRIVACY_POLICY_URL,
      supportUrl: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to,
      subject: lang === 'en'
        ? `New lead from your Chatbu bot: ${botName}`
        : `Chatbu botunuzdan yeni bir kayıt: ${botName}`,
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Lead notification sent to ${to}`);
    } catch (error) {
      this.logger.error(`Error sending lead notification to ${to}:`, error);
      throw error;
    }
  }

  async sendNegativeFeedbackNotification(
    to: string,
    botName: string,
    feedbackData: { answer: 'PARTIAL' | 'NO'; comment?: string },
    lang: string = 'en',
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'negative_feedback_notification.html' : 'negative_feedback_notification_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    const answerLabelMap = {
      PARTIAL: lang === 'en' ? 'Partially satisfied' : 'Kısmen memnun',
      NO: lang === 'en' ? 'Not satisfied' : 'Memnun değil',
    };

    const html = template({
      botName,
      answerLabel: answerLabelMap[feedbackData.answer],
      comment: feedbackData.comment,
      createdAt: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR'),
      company: process.env.COMPANY_NAME,
      privacyPolicyUrl: process.env.FRONTEND_PRIVACY_POLICY_URL,
      supportUrl: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to,
      subject: lang === 'en'
        ? `Negative feedback on your Chatbu bot: ${botName}`
        : `Chatbu botunuzda olumsuz geri bildirim: ${botName}`,
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Negative feedback notification sent to ${to}`);
    } catch (error) {
      this.logger.error(`Error sending negative feedback notification to ${to}:`, error);
      throw error;
    }
  }
}
