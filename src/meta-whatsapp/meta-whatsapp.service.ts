import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppWebhookEntry {
    id: string;
    changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
    field: string;
    value: WhatsAppWebhookValue;
}

export interface WhatsAppWebhookValue {
    messaging_product: string;
    metadata: {
        display_phone_number: string;
        phone_number_id: string;
    };
    contacts?: Array<{
        profile: { name: string };
        wa_id: string;
    }>;
    messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        text?: { body: string };
        type: string;
    }>;
    statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
    }>;
}

export interface WhatsAppWebhookBody {
    object: string;
    entry: WhatsAppWebhookEntry[];
}

@Injectable()
export class MetaWhatsappService {
    private readonly logger = new Logger(MetaWhatsappService.name);

    constructor(private readonly configService: ConfigService) { }

    verifyWebhook(mode: string, verifyToken: string, challenge: string): string {
        const expectedToken = this.configService.get<string>('META_WEBHOOK_VERIFY_TOKEN');

        if (mode !== 'subscribe') {
            this.logger.warn('Webhook verification failed: invalid hub.mode');
            throw new ForbiddenException('Invalid hub.mode');
        }

        if (verifyToken !== expectedToken) {
            this.logger.warn('Webhook verification failed: token mismatch');
            throw new ForbiddenException('Verify token mismatch');
        }

        this.logger.log('WhatsApp webhook verified successfully');
        return challenge;
    }

    handleWebhook(body: WhatsAppWebhookBody): void {
        if (body.object !== 'whatsapp_business_account') {
            this.logger.warn(`Unexpected webhook object type: ${body.object}`);
            return;
        }

        for (const entry of body.entry || []) {
            const whatsappBusinessAccountId = entry.id;

            for (const change of entry.changes || []) {
                if (change.field !== 'messages') continue;

                const value = change.value;
                const phoneNumberId = value?.metadata?.phone_number_id;

                // Process incoming messages
                for (const message of value?.messages || []) {
                    this.logger.log(
                        `Incoming message | phone_number_id=${phoneNumberId}` +
                        ` | whatsapp_business_account_id=${whatsappBusinessAccountId}` +
                        ` | wa_id=${message.from}` +
                        ` | type=${message.type}` +
                        ` | text=${message.text?.body ?? '(non-text)'}`,
                    );
                    // TODO: route message to bot pipeline
                }

                // Process status updates
                for (const status of value?.statuses || []) {
                    this.logger.log(
                        `Message status update | phone_number_id=${phoneNumberId}` +
                        ` | message_id=${status.id}` +
                        ` | status=${status.status}` +
                        ` | recipient_id=${status.recipient_id}`,
                    );
                    // TODO: update message delivery status in DB
                }
            }
        }
    }
}
