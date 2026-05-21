import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetaWhatsappController } from './meta-whatsapp.controller';
import { MetaWhatsappService } from './meta-whatsapp.service';

@Module({
    imports: [ConfigModule],
    controllers: [MetaWhatsappController],
    providers: [MetaWhatsappService],
})
export class MetaWhatsappModule { }
