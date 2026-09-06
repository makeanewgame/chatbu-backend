import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { LegalDocumentService } from './legal-document.service';
import {
  RecordLegalAcceptanceDto,
  RecordPublicLegalAcceptanceDto,
} from './dto/legal-document.dto';

function extractClientInfo(req: Request) {
  const ip =
    ((req.headers['x-forwarded-for'] as string) ?? '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) ?? '';
  return { ip, userAgent };
}

// Public: legal document text is meant to be publicly readable (same as any
// hosted privacy policy page), so the read routes carry no auth guard.
//
// The accept surface is split (Slice 5, 2026-09-06):
//   POST :slug/accept        — authenticated; subject identity comes from
//                              the verified JWT, never the body, so an
//                              acceptance can't be forged onto another
//                              user or team.
//   POST :slug/accept-public — unauthenticated visitor surface; the row is
//                              pinned to subjectType='visitor' with no
//                              subjectId/teamId, context OTHER.
// Admin mutation + audit-read routes live in legal-document-admin.controller.ts.
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
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  recordAcceptance(
    @Param('slug') slug: string,
    @Body() dto: RecordLegalAcceptanceDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent } = extractClientInfo(req);
    const user = (req as any).user ?? {};
    return this.legalDocumentService.recordAcceptance(
      slug,
      dto,
      {
        subjectType: 'user',
        subjectId: user.sub ?? user.id ?? null,
        teamId: user.teamId ?? null,
      },
      ip,
      userAgent,
    );
  }

  @Post(':slug/accept-public')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  recordPublicAcceptance(
    @Param('slug') slug: string,
    @Body() dto: RecordPublicLegalAcceptanceDto,
    @Req() req: Request,
  ) {
    const { ip, userAgent } = extractClientInfo(req);
    return this.legalDocumentService.recordAcceptance(
      slug,
      { ...dto, context: 'OTHER' },
      { subjectType: 'visitor', subjectId: null, teamId: null },
      ip,
      userAgent,
    );
  }
}
