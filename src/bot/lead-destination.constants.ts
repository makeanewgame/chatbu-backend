export type LeadChannel = 'email'; // P2 will add: 'sms' | 'slack' | 'teams' | 'whatsapp' | 'webhook'
export const LEAD_CHANNELS: readonly LeadChannel[] = ['email'] as const;

export interface LeadDestination {
  channel: LeadChannel;
  target: string;
  label?: string;
  enabled: boolean;
}

export const MAX_LEAD_DESTINATIONS = 20;
