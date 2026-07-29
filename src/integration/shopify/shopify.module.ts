import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BotModule } from 'src/bot/bot.module';
import { ShopifyController } from './shopify.controller';
import { ShopifyService } from './shopify.service';
import { ShopifyTokenGuard } from './shopify-token.guard';
import { ShopifyClientSecretGuard } from './shopify-client-secret.guard';

@Module({
    imports: [PrismaModule, JwtModule.register({}), BotModule],
    controllers: [ShopifyController],
    providers: [ShopifyService, ShopifyTokenGuard, ShopifyClientSecretGuard],
})
export class ShopifyModule { }
