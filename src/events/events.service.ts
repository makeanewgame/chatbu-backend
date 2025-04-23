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

        await this.client.on('notification', async (msg) => {
            const payload = JSON.parse(msg.payload);
            // Mesajı websocket üzerinden frontend'e ilet
            // Burada socket.io ile frontend'e bildirim gönderebilirsiniz
            // Örnek: this.eventsGateway.notifyUser(payload.userId, payload)
            await this.eventGateWay.notifyUser(payload.userId, payload);

        });

        console.log('EventsService initialized');
    }
}
