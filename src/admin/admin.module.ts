import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SettingsController } from './settings.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    controllers: [AdminController, SettingsController],
    providers: [AdminService],
    imports: [PrismaModule, JwtModule],
})
export class AdminModule { }
