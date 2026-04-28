import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SettingsController } from './settings.controller';
import { PricePlanController } from './price-plan.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
    controllers: [AdminController, SettingsController, PricePlanController],
    providers: [AdminService],
    imports: [PrismaModule, JwtModule, MinioClientModule, ConfigModule, SubscriptionModule, HttpModule],
})
export class AdminModule { }
