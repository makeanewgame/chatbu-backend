import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { EventsModule } from './events.module';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService implements OnModuleInit {

    constructor(private eventGateWay: EventsGateway) { }

    private client = new Client({
        connectionString: process.env.DATABASE_URL,
    });


    async onModuleInit() {
        console.log('EventsService initializing...');
        await this.client.connect();
        await this.client.query('LISTEN storage_updates');
        await this.client.query('LISTEN content_updates');

        await this.client.on('notification', async (msg) => {
            const payload = JSON.parse(msg.payload);

            if (msg.channel === 'storage_updates') {
                const tempPayload = {
                    type: 'file',
                    data: [payload],
                }
                console.log('Received notification on storage_updates:', payload);
                await this.eventGateWay.notifyUser(payload.teamId, tempPayload);
            }

            if (msg.channel === 'content_updates') {
                const tempPayload = {
                    type: 'content',
                    data: [payload],
                }
                console.log('Received notification on content_updates:', payload);
                await this.eventGateWay.notifyUser(payload.teamId, tempPayload);
            }
        });

        console.log('EventsService initialized');
    }
}
