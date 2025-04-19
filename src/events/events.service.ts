import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class EventsService implements OnModuleInit {

    constructor() { }

    private client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    async onModuleInit() {
        console.log('EventsService initializing...', process.env.DATABASE_URL);
        console.log(this.client);
        await this.client.connect();
        await this.client.query('LISTEN storage_updates');



        await this.client.on('notification', async (msg) => {
            const payload = JSON.parse(msg.payload);
            // Mesajı websocket üzerinden frontend'e ilet
            console.log('Storage updated:', payload);
        });
        console.log('EventsService initialized');
    }
}
