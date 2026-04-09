import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [PrismaModule, SubscriptionModule],
  providers: [EventsGateway, EventsService]
})
export class EventsModule { }
