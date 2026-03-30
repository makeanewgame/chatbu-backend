import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SettingsController } from './settings.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    controllers: [AdminController, SettingsController],
    providers: [AdminService],
    imports: [PrismaModule, JwtModule, MinioClientModule, ConfigModule],
})
export class AdminModule { }
