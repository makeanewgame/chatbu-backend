import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { LegalDocumentService } from './legal-document.service';
import { RecordLegalAcceptanceDto } from './dto/legal-document.dto';

function extractClientInfo(req: Request) {
  const ip =
    ((req.headers['x-forwarded-for'] as string) ?? '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) ?? '';
  return { ip, userAgent };
}

// Public: legal document text is meant to be publicly readable (same as any
// hosted privacy policy page), so these routes carry no auth guard. Only
// admin mutation routes (legal-document-admin.controller.ts) are protected.
@Controller('legal-documents')
export class LegalDocumentPublicController {
  constructor(private legalDocumentService: LegalDocumentService) {}

  @Get(':slug')
  getPublished(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.legalDocumentService.getPublished(slug, locale);
  }

  @Get(':slug/versions/:versionNumber')
  getVersion(
    @Param('slug') slug: string,
    @Param('versionNumber') versionNumber: string,
    @Query('locale') locale?: string,
  ) {
    return this.legalDocumentService.getVersionByNumber(slug, Number(versionNumber), locale);
  }

  @Post(':slug/accept')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  recordAcceptance(
    @Param('slug') slug: string,
    @Body() dto: RecordLegalAcceptanceDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent } = extractClientInfo(req);
    return this.legalDocumentService.recordAcceptance(slug, dto, ip, userAgent);
  }
}
