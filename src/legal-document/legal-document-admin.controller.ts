import { Body, Controller, Delete, Get, Param, Post, Patch, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from 'src/admin/guards/admin.guard';
import { LegalDocumentService } from './legal-document.service';
import {
  CreateLegalDocumentDto,
  CreateLegalDocumentVersionDto,
  UpdateLegalDocumentContentDto,
} from './dto/legal-document.dto';

@Controller('admin/legal-documents')
@UseGuards(AccessTokenGuard, AdminGuard)
export class LegalDocumentAdminController {
  constructor(private legalDocumentService: LegalDocumentService) {}

  @Get()
  listDocuments() {
    return this.legalDocumentService.listDocuments();
  }

  @Post()
  createDocument(@Body() dto: CreateLegalDocumentDto) {
    return this.legalDocumentService.createDocument(dto);
  }

  @Delete(':slug')
  deleteDocument(@Param('slug') slug: string) {
    return this.legalDocumentService.deleteDocument(slug);
  }

  @Get(':slug/versions')
  listVersions(@Param('slug') slug: string) {
    return this.legalDocumentService.listVersions(slug);
  }

  @Post(':slug/versions')
  createDraftVersion(
    @Param('slug') slug: string,
    @Body() dto: CreateLegalDocumentVersionDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.sub || req.user?.id;
    return this.legalDocumentService.createDraftVersion(slug, dto, adminId);
  }

  @Patch(':slug/versions/:versionId/content/:locale')
  updateContent(
    @Param('slug') slug: string,
    @Param('versionId') versionId: string,
    @Param('locale') locale: string,
    @Body() dto: UpdateLegalDocumentContentDto,
  ) {
    return this.legalDocumentService.updateContent(slug, versionId, locale, dto);
  }

  @Post(':slug/versions/:versionId/content/:locale/approve')
  approveTranslation(
    @Param('slug') slug: string,
    @Param('versionId') versionId: string,
    @Param('locale') locale: string,
    @Req() req: any,
  ) {
    const adminId = req.user?.sub || req.user?.id;
    return this.legalDocumentService.approveTranslation(slug, versionId, locale, adminId);
  }

  @Post(':slug/versions/:versionId/publish')
  publishVersion(@Param('slug') slug: string, @Param('versionId') versionId: string) {
    return this.legalDocumentService.publishVersion(slug, versionId);
  }
}
