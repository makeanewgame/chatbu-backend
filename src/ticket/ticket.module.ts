import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsModule } from 'src/events/events.module';

@Module({
    imports: [EventsModule],
    controllers: [TicketController],
    providers: [TicketService, PrismaService],
    exports: [TicketService],
})
export class TicketModule { }
