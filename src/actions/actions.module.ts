import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';

@Module({
    imports: [PrismaModule, HttpModule, JwtModule],
    controllers: [ActionsController],
    providers: [ActionsService],
    exports: [ActionsService],
})
export class ActionsModule { }
