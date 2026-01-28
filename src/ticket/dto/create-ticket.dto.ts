export class CreateTicketDto {
    title: string;
    description: string;
    category: 'BUG_REPORT' | 'FEATURE_REQUEST' | 'BILLING' | 'GENERAL';
}
