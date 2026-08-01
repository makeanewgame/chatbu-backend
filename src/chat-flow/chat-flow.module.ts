import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ChatFlowController } from './chat-flow.controller';
import { ChatFlowService } from './chat-flow.service';

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [ChatFlowController],
  providers: [ChatFlowService],
  exports: [ChatFlowService],
})
export class ChatFlowModule {}
