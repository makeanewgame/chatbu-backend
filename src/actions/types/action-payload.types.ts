export type ActionType = 'LINK' | 'PRODUCT_CARDS' | 'AUTH_FLOW' | 'WEBHOOK';

export interface LinkActionData {
    url: string;
    label: string;
    target: string;
    icon?: string;
}

export interface ProductCard {
    title: string;
    price?: string | number;
    image?: string;
    url?: string;
    [key: string]: any;
}

export interface ProductCardsActionData {
    cards: ProductCard[];
}

export interface AuthFlowStep {
    id: string;
    type: 'input' | 'webhook';
    inputType?: 'phone' | 'otp' | 'text';
    prompt?: string;
    completesAuth?: boolean;
}

export interface AuthFlowActionData {
    step: AuthFlowStep | null;
    completed: boolean;
    authToken?: string;
}

export interface WebhookActionData {
    content: string;
    raw?: any;
}

export type ActionPayload =
    | { type: 'LINK'; actionId: string; data: LinkActionData }
    | { type: 'PRODUCT_CARDS'; actionId: string; data: ProductCardsActionData }
    | { type: 'AUTH_FLOW'; actionId: string; data: AuthFlowActionData }
    | { type: 'WEBHOOK'; actionId: string; data: WebhookActionData };
