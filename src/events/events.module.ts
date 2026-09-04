import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { ConversationBroadcastService } from './conversation-broadcast.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { MinioClientModule } from 'src/minio-client/minio-client.module';

@Module({
  imports: [
    PrismaModule,
    SubscriptionModule,
    JwtModule.register({}),
    MinioClientModule,
  ],
  providers: [EventsGateway, EventsService, ConversationBroadcastService],
  exports: [EventsGateway, ConversationBroadcastService],
})
export class EventsModule { }
