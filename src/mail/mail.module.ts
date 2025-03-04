import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env' }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST'),
          post: config.get('SMTP_PORT'),
          secure: true,
          preview: true,
          auth: {
            user: config.get('SMTP_EMAIL_USERNAME'),
            pass: config.get('SMTP_EMAIL_PASSWORD')
          },
          defaults: {
            from: config.get('ADMIN_EMAIL')
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true
            }
          }
        }
      })
    })
  ],
  controllers: [MailController],
  providers: [MailService]
})
export class MailModule { }
