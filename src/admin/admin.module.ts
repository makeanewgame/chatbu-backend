import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    controllers: [AdminController],
    imports: [PrismaModule, JwtModule],
    providers: [AdminService]
})
export class AdminModule { }
