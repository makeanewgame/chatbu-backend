import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { EventsGateway } from './events.gateway';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventsService implements OnModuleInit {

    constructor(
        private eventGateWay: EventsGateway,
        private prisma: PrismaService,
    ) { }

    private client = new Client({
        connectionString: process.env.DATABASE_URL,
    });


    async onModuleInit() {
        console.log('EventsService initializing...');
        await this.client.connect();
        await this.client.query('LISTEN storage_updates');
        await this.client.query('LISTEN content_updates');
        await this.client.query('LISTEN ingestion_task_updates');

        await this.client.on('notification', async (msg) => {
            const payload = JSON.parse(msg.payload);

            if (msg.channel === 'storage_updates') {
                console.log('Received notification on storage_updates:', payload);
                const record = await this.prisma.storage.findUnique({ where: { id: payload.id }, select: { teamId: true } });
                if (!record?.teamId) return;
                const tempPayload = { type: 'file', data: [payload] };
                await this.eventGateWay.notifyUser(record.teamId, tempPayload);
            }

            if (msg.channel === 'content_updates') {
                console.log('Received notification on content_updates:', payload);
                const record = await this.prisma.content.findUnique({ where: { id: payload.id }, select: { teamId: true } });
                if (!record?.teamId) return;
                const tempPayload = { type: 'content', data: [payload] };
                await this.eventGateWay.notifyUser(record.teamId, tempPayload);
            }

            if (msg.channel === 'ingestion_task_updates') {
                const tempPayload = {
                    type: 'ingestion_progress',
                    data: [payload],
                };
                console.log('Received notification on ingestion_task_updates:', payload);
                await this.eventGateWay.notifyUser(payload.customer_cuid, tempPayload);
            }
        });

        console.log('EventsService initialized');
    }
}
