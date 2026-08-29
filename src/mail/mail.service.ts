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
  async sendLostPasswordCodeMail(email: string, code: string, lang: string) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'forgot-password-code.html' : 'forgot-password-code_tr.html',
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
      subject: lang === 'en' ? 'Your password reset code' : 'Şifre sıfırlama kodunuz',
      html: html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Password reset code mail sent to ${email}`);
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

  // Locales for which a translated `lead_notification_{code}.html` template
  // exists. `en` uses the un-suffixed filename (`lead_notification.html`).
  // Adding a new locale = add its template file + register the code here +
  // add its `toLocaleString` tag + subject line. Unknown / unlisted locales
  // fall back to English.
  private static readonly LEAD_NOTIFICATION_LOCALES = new Set([
    'en', 'tr', 'de', 'es', 'fr', 'it', 'ru', 'ar',
  ]);
  private static readonly LEAD_NOTIFICATION_INTL_TAGS: Record<string, string> = {
    en: 'en-US', tr: 'tr-TR', de: 'de-DE', es: 'es-ES', fr: 'fr-FR',
    it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA',
  };
  private static readonly LEAD_NOTIFICATION_SUBJECTS: Record<string, (botName: string) => string> = {
    en: (n) => `New lead from your Chatbu bot: ${n}`,
    tr: (n) => `Chatbu botunuzdan yeni bir kayıt: ${n}`,
    de: (n) => `Neuer Lead von Ihrem Chatbu-Bot: ${n}`,
    es: (n) => `Nuevo lead de tu bot Chatbu: ${n}`,
    fr: (n) => `Nouveau lead depuis votre bot Chatbu : ${n}`,
    it: (n) => `Nuovo lead dal tuo bot Chatbu: ${n}`,
    ru: (n) => `Новый лид от вашего Chatbu-бота: ${n}`,
    ar: (n) => `عميل محتمل جديد من روبوت Chatbu الخاص بك: ${n}`,
  };

  // Same 8-locale coverage as lead notifications above. The three
  // registries here share the same shape — LOCALES set for template
  // filename lookup, INTL_TAGS for `toLocaleString`, SUBJECTS factory
  // for the email subject. Add a locale = create the template + register
  // it in all three constants. Unknown / unlisted locales fall back to
  // English.
  private static readonly HANDOFF_NOTIFICATION_LOCALES = new Set([
    'en', 'tr', 'de', 'es', 'fr', 'it', 'ru', 'ar',
  ]);
  private static readonly HANDOFF_NOTIFICATION_INTL_TAGS: Record<string, string> = {
    en: 'en-US', tr: 'tr-TR', de: 'de-DE', es: 'es-ES', fr: 'fr-FR',
    it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA',
  };
  private static readonly HANDOFF_NOTIFICATION_SUBJECTS: Record<string, (botName: string) => string> = {
    en: (n) => `Live chat requested on your Chatbu bot: ${n}`,
    tr: (n) => `Chatbu botunuzda canlı destek talebi: ${n}`,
    de: (n) => `Live-Chat auf Ihrem Chatbu-Bot angefordert: ${n}`,
    es: (n) => `Chat en vivo solicitado en tu bot Chatbu: ${n}`,
    fr: (n) => `Chat en direct demandé sur votre bot Chatbu : ${n}`,
    it: (n) => `Chat dal vivo richiesta sul tuo bot Chatbu: ${n}`,
    ru: (n) => `На вашем Chatbu-боте запрошен онлайн-чат: ${n}`,
    ar: (n) => `تم طلب دردشة مباشرة على روبوت Chatbu الخاص بك: ${n}`,
  };

  private static readonly NEGATIVE_FEEDBACK_LOCALES = new Set([
    'en', 'tr', 'de', 'es', 'fr', 'it', 'ru', 'ar',
  ]);
  private static readonly NEGATIVE_FEEDBACK_INTL_TAGS: Record<string, string> = {
    en: 'en-US', tr: 'tr-TR', de: 'de-DE', es: 'es-ES', fr: 'fr-FR',
    it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA',
  };
  private static readonly NEGATIVE_FEEDBACK_SUBJECTS: Record<string, (botName: string) => string> = {
    en: (n) => `Negative feedback on your Chatbu bot: ${n}`,
    tr: (n) => `Chatbu botunuzda olumsuz geri bildirim: ${n}`,
    de: (n) => `Negatives Feedback zu Ihrem Chatbu-Bot: ${n}`,
    es: (n) => `Feedback negativo en tu bot Chatbu: ${n}`,
    fr: (n) => `Retour négatif sur votre bot Chatbu : ${n}`,
    it: (n) => `Feedback negativo sul tuo bot Chatbu: ${n}`,
    ru: (n) => `Негативный отзыв о вашем Chatbu-боте: ${n}`,
    ar: (n) => `ملاحظات سلبية على روبوت Chatbu الخاص بك: ${n}`,
  };
  // Answer labels shown as the "answer-badge" inside the template body.
  // Keys are the raw `feedbackData.answer` values from widget.service.ts.
  private static readonly NEGATIVE_FEEDBACK_ANSWER_LABELS: Record<string, Record<'PARTIAL' | 'NO', string>> = {
    en: { PARTIAL: 'Partially satisfied', NO: 'Not satisfied' },
    tr: { PARTIAL: 'Kısmen memnun', NO: 'Memnun değil' },
    de: { PARTIAL: 'Teilweise zufrieden', NO: 'Nicht zufrieden' },
    es: { PARTIAL: 'Parcialmente satisfecho', NO: 'No satisfecho' },
    fr: { PARTIAL: 'Partiellement satisfait', NO: 'Non satisfait' },
    it: { PARTIAL: 'Parzialmente soddisfatto', NO: 'Non soddisfatto' },
    ru: { PARTIAL: 'Частично удовлетворён', NO: 'Не удовлетворён' },
    ar: { PARTIAL: 'راضٍ جزئيًا', NO: 'غير راضٍ' },
  };

  async sendLeadNotification(
    to: string,
    botName: string,
    leadData: { name?: string; email?: string; phone?: string; notes?: string },
    lang: string = 'en',
  ) {
    const locale = MailService.LEAD_NOTIFICATION_LOCALES.has(lang) ? lang : 'en';
    const rootDir = process.cwd();

    const filename = locale === 'en'
      ? 'lead_notification.html'
      : `lead_notification_${locale}.html`;
    const templatePath = path.join(rootDir, 'dist', 'templates', filename);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    const html = template({
      botName,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      notes: leadData.notes,
      createdAt: new Date().toLocaleString(
        MailService.LEAD_NOTIFICATION_INTL_TAGS[locale],
      ),
      leadsInboxUrl: `${process.env.FRONTEND_URL}/leads`,
      company: process.env.COMPANY_NAME,
      privacyPolicyUrl: process.env.FRONTEND_PRIVACY_POLICY_URL,
      supportUrl: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to,
      subject: MailService.LEAD_NOTIFICATION_SUBJECTS[locale](botName),
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Lead notification sent to ${to} (locale=${locale})`);
    } catch (error) {
      this.logger.error(`Error sending lead notification to ${to}:`, error);
      throw error;
    }
  }

  async sendHandoffNotification(
    to: string,
    botName: string,
    sessionLink: string,
    lang: string = 'en',
  ) {
    const locale = MailService.HANDOFF_NOTIFICATION_LOCALES.has(lang) ? lang : 'en';
    const rootDir = process.cwd();

    const filename = locale === 'en'
      ? 'handoff_notification.html'
      : `handoff_notification_${locale}.html`;
    const templatePath = path.join(rootDir, 'dist', 'templates', filename);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    const html = template({
      botName,
      sessionLink,
      createdAt: new Date().toLocaleString(
        MailService.HANDOFF_NOTIFICATION_INTL_TAGS[locale],
      ),
      company: process.env.COMPANY_NAME,
      privacyPolicyUrl: process.env.FRONTEND_PRIVACY_POLICY_URL,
      supportUrl: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to,
      subject: MailService.HANDOFF_NOTIFICATION_SUBJECTS[locale](botName),
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Handoff notification sent to ${to} (locale=${locale})`);
    } catch (error) {
      this.logger.error(`Error sending handoff notification to ${to}:`, error);
      throw error;
    }
  }

  async sendLeadVerificationCode(
    to: string,
    code: string,
    botName: string,
    lang: string = 'en',
  ) {
    const rootDir = process.cwd();

    const templatePath = path.join(
      rootDir,
      'dist',
      'templates',
      lang === 'en' ? 'lead_verification.html' : 'lead_verification_tr.html',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    const html = template({
      botName,
      code,
      privacy_policy_url: process.env.FRONTEND_PRIVACY_POLICY_URL,
      support_url: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to,
      subject: lang === 'en' ? 'Your Chatbu confirmation code' : 'Chatbu doğrulama kodunuz',
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Lead verification code sent to ${to}`);
    } catch (error) {
      this.logger.error(`Error sending lead verification code to ${to}:`, error);
      throw error;
    }
  }

  async sendNegativeFeedbackNotification(
    to: string,
    botName: string,
    feedbackData: { answer: 'PARTIAL' | 'NO'; comment?: string },
    lang: string = 'en',
  ) {
    const locale = MailService.NEGATIVE_FEEDBACK_LOCALES.has(lang) ? lang : 'en';
    const rootDir = process.cwd();

    const filename = locale === 'en'
      ? 'negative_feedback_notification.html'
      : `negative_feedback_notification_${locale}.html`;
    const templatePath = path.join(rootDir, 'dist', 'templates', filename);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);

    const html = template({
      botName,
      answerLabel:
        MailService.NEGATIVE_FEEDBACK_ANSWER_LABELS[locale][feedbackData.answer],
      comment: feedbackData.comment,
      createdAt: new Date().toLocaleString(
        MailService.NEGATIVE_FEEDBACK_INTL_TAGS[locale],
      ),
      company: process.env.COMPANY_NAME,
      privacyPolicyUrl: process.env.FRONTEND_PRIVACY_POLICY_URL,
      supportUrl: process.env.FRONTEND_SUPPORT_URL,
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to,
      subject: MailService.NEGATIVE_FEEDBACK_SUBJECTS[locale](botName),
      html,
    };

    try {
      await this.mailerService.sendMail(mailOptions);
      this.logger.info(`Negative feedback notification sent to ${to} (locale=${locale})`);
    } catch (error) {
      this.logger.error(`Error sending negative feedback notification to ${to}:`, error);
      throw error;
    }
  }
}
