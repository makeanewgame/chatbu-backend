import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MetaController } from './meta.controller';
import { MetaIntegrationController } from './meta-integration.controller';
import { MetaService } from './meta.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BotModule } from 'src/bot/bot.module';

@Module({
    imports: [PrismaModule, BotModule, JwtModule],
    controllers: [MetaController, MetaIntegrationController],
    providers: [MetaService],
})
export class MetaModule { }
