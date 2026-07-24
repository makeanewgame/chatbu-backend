import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body
 * using the app secret. Meta signs the exact bytes it sends, so the caller
 * MUST pass the raw body buffer (see the bodyParser `verify` hook in main.ts),
 * not the re-serialized parsed object.
 *
 * Returns false on any missing input or mismatch (fail closed).
 */
export function verifyMetaWebhookSignature(
    rawBody: Buffer | undefined,
    signatureHeader: string | undefined,
    appSecret: string | undefined,
): boolean {
    if (!rawBody || !signatureHeader || !appSecret) {
        return false;
    }

    // Header format: "sha256=<hex>"
    const [algorithm, providedHex] = signatureHeader.split('=');
    if (algorithm !== 'sha256' || !providedHex) {
        return false;
    }

    const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const providedBuf = Buffer.from(providedHex, 'hex');

    if (expectedBuf.length !== providedBuf.length) {
        return false;
    }

    return timingSafeEqual(expectedBuf, providedBuf);
}
