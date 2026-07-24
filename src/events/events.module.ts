import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [PrismaModule, SubscriptionModule, JwtModule.register({})],
  providers: [EventsGateway, EventsService],
  exports: [EventsGateway],
})
export class EventsModule { }
