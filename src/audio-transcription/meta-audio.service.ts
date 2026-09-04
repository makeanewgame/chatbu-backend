import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface FetchedAudio {
  audio: Buffer;
  mimeType: string;
}

// Voice notes are small (Meta caps IG/Messenger voice clips around a
// minute, WhatsApp around 16 MB for media generally) — but we never
// need more than the AudioTranscriptionService's own 5 MB cap, so bail
// out of the download early rather than buffering something huge.
const MAX_DOWNLOAD_BYTES = 6 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

/**
 * Channel-side audio fetchers for the Meta family of webhooks. Kept in
 * the audio-transcription module (not the channel services) so the
 * download shape — size cap, timeout, mime fallback — stays in one
 * place; the channel handlers stay pure pipes.
 *
 * Two transports:
 *  - Messenger / Instagram DM: the webhook carries a CDN URL directly
 *    (`message.attachments[].payload.url`), no auth needed.
 *  - WhatsApp Cloud API: the webhook carries a media id; resolving it
 *    is a two-step Graph dance (GET /<media_id> → { url }, then GET
 *    url with the same Bearer token).
 */
@Injectable()
export class MetaAudioService {
  private readonly logger = new Logger(MetaAudioService.name);

  /**
   * Download a Messenger/IG audio attachment from its CDN URL.
   * Returns null (never throws) on any failure — callers treat null as
   * "no usable audio" and fall back to the silent-drop path.
   */
  async downloadMessengerAudio(url: string): Promise<FetchedAudio | null> {
    try {
      const { data, headers } = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxContentLength: MAX_DOWNLOAD_BYTES,
      });
      return {
        audio: Buffer.from(data),
        mimeType: String(headers['content-type'] || 'audio/mp4'),
      };
    } catch (err) {
      this.logger.warn(`[meta-audio] messenger CDN download failed: ${err?.message}`);
      return null;
    }
  }

  /**
   * Resolve + download a WhatsApp Cloud API media object.
   * Returns null (never throws) on any failure.
   */
  async downloadWhatsAppAudio(
    mediaId: string,
    accessToken: string,
  ): Promise<FetchedAudio | null> {
    try {
      const { data: media } = await axios.get(
        `https://graph.facebook.com/v23.0/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: DOWNLOAD_TIMEOUT_MS,
        },
      );
      if (!media?.url) {
        this.logger.warn(`[meta-audio] WA media ${mediaId} resolved without url`);
        return null;
      }
      const { data, headers } = await axios.get<ArrayBuffer>(media.url, {
        responseType: 'arraybuffer',
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxContentLength: MAX_DOWNLOAD_BYTES,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return {
        audio: Buffer.from(data),
        // WhatsApp voice notes are audio/ogg (opus); the media resolve
        // response's mime_type is authoritative when present.
        mimeType: String(media.mime_type || headers['content-type'] || 'audio/ogg'),
      };
    } catch (err) {
      this.logger.warn(`[meta-audio] WA media ${mediaId} download failed: ${err?.message}`);
      return null;
    }
  }
}
