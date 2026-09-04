import axios from 'axios';
import { MetaAudioService } from './meta-audio.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MetaAudioService', () => {
  let service: MetaAudioService;

  beforeEach(() => {
    service = new MetaAudioService();
    mockedAxios.get.mockReset();
  });

  describe('downloadMessengerAudio', () => {
    it('returns buffer + content-type from the CDN', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: new Uint8Array([1, 2, 3]).buffer,
        headers: { 'content-type': 'audio/mp4' },
      });
      const out = await service.downloadMessengerAudio('https://cdn.fbsbx.com/x.mp4');
      expect(out).not.toBeNull();
      expect(out!.mimeType).toBe('audio/mp4');
      expect(out!.audio.length).toBe(3);
    });

    it('returns null on download failure (never throws)', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('403'));
      const out = await service.downloadMessengerAudio('https://cdn.fbsbx.com/x.mp4');
      expect(out).toBeNull();
    });
  });

  describe('downloadWhatsAppAudio', () => {
    it('resolves media id then downloads with bearer token', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { url: 'https://lookaside.fbsbx.com/m/abc', mime_type: 'audio/ogg' },
        })
        .mockResolvedValueOnce({
          data: new Uint8Array([9, 9]).buffer,
          headers: { 'content-type': 'application/octet-stream' },
        });
      const out = await service.downloadWhatsAppAudio('media123', 'tok');
      expect(out).not.toBeNull();
      // media resolve mime_type wins over the download's content-type
      expect(out!.mimeType).toBe('audio/ogg');
      expect(out!.audio.length).toBe(2);
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        'https://graph.facebook.com/v23.0/media123',
        expect.objectContaining({
          headers: { Authorization: 'Bearer tok' },
        }),
      );
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        'https://lookaside.fbsbx.com/m/abc',
        expect.objectContaining({
          headers: { Authorization: 'Bearer tok' },
          responseType: 'arraybuffer',
        }),
      );
    });

    it('returns null when the media resolve has no url', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { id: 'media123' } });
      const out = await service.downloadWhatsAppAudio('media123', 'tok');
      expect(out).toBeNull();
    });

    it('returns null on resolve failure (never throws)', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('expired token'));
      const out = await service.downloadWhatsAppAudio('media123', 'tok');
      expect(out).toBeNull();
    });
  });
});
