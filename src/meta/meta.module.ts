import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BotModule } from 'src/bot/bot.module';

@Module({
    imports: [PrismaModule, BotModule],
    controllers: [MetaController],
    providers: [MetaService],
})
export class MetaModule { }
