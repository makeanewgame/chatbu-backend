import { createHmac, timingSafeEqual } from 'crypto';

export interface ParsedSignedRequest {
    algorithm: string;
    issued_at: number;
    user_id?: string;
    [key: string]: any;
}

function base64UrlDecode(input: string): Buffer {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64');
}

/**
 * Verifies and decodes a Meta `signed_request` payload (sent to deauthorize/data-deletion
 * callbacks) using the app secret. Returns null if the signature doesn't match.
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): ParsedSignedRequest | null {
    const [encodedSig, payload] = signedRequest.split('.', 2);

    if (!encodedSig || !payload) return null;

    const expectedSig = createHmac('sha256', appSecret).update(payload).digest();
    const providedSig = base64UrlDecode(encodedSig);

    if (expectedSig.length !== providedSig.length || !timingSafeEqual(expectedSig, providedSig)) {
        return null;
    }

    const data = JSON.parse(base64UrlDecode(payload).toString('utf8'));

    if (data.algorithm !== 'HMAC-SHA256') return null;

    return data;
}
