import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { InternalApiKeyGuard } from 'src/integration/google-calendar/internal-api-key.guard';
import { IUser } from 'src/util/interfaces';
import { LeadService } from './lead.service';
import { SubmitLeadDto } from './dto/submit-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { MarkLeadStatusDto } from './dto/mark-lead-status.dto';
import { RequestLeadVerificationDto } from './dto/request-lead-verification.dto';
import { VerifyLeadDto } from './dto/verify-lead.dto';
import { RequestSmsVerificationDto } from './dto/request-sms-verification.dto';
import { VerifySmsDto } from './dto/verify-sms.dto';

@ApiTags('Lead Capture')
@Controller('lead')
export class LeadController {
  constructor(private leadService: LeadService) { }

  /**
   * POST /api/lead/submit
   * Called by the gateway's capture_lead MCP tool. Internal service auth only.
   */
  @ApiOperation({ summary: 'Submit a captured lead (internal, called by gateway)' })
  @ApiResponse({ status: 200, description: 'Lead submitted and delivery attempted' })
  @UseGuards(InternalApiKeyGuard)
  @Post('submit')
  async submit(@Body() body: SubmitLeadDto) {
    return this.leadService.submit(body);
  }

  /**
   * POST /api/lead/request-verification
   * Called by the gateway's request_lead_verification MCP tool.
   */
  @ApiOperation({ summary: 'Send a 6-digit lead verification code (internal, called by gateway)' })
  @ApiResponse({ status: 200, description: 'Code sent or rate limited' })
  @ApiResponse({ status: 400, description: 'Verification not required for this bot' })
  @UseGuards(InternalApiKeyGuard)
  @Throttle({ default: { ttl: 3600000, limit: 20 } })
  @Post('request-verification')
  @HttpCode(200)
  async requestVerification(@Body() body: RequestLeadVerificationDto) {
    return this.leadService.requestVerification(body);
  }

  /**
   * POST /api/lead/verify
   * Called by the gateway to exchange a 6-digit code for a verification JWT.
   */
  @ApiOperation({ summary: 'Verify a lead code and issue a verification token (internal)' })
  @ApiResponse({ status: 200, description: 'Verification result returned' })
  @UseGuards(InternalApiKeyGuard)
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: VerifyLeadDto) {
    return this.leadService.verifyCode(body);
  }

  /**
   * POST /api/lead/request-sms-verification
   * Called by the gateway's request_lead_sms_verification MCP tool.
   */
  @ApiOperation({ summary: 'Send a 6-digit SMS verification code via NETGSM (internal, called by gateway)' })
  @ApiResponse({ status: 200, description: 'Code sent or rate limited' })
  @ApiResponse({ status: 400, description: 'Verification not required, or KVKK consent missing' })
  @UseGuards(InternalApiKeyGuard)
  @Throttle({ default: { ttl: 3600000, limit: 20 } })
  @Post('request-sms-verification')
  @HttpCode(200)
  async requestSmsVerification(@Body() body: RequestSmsVerificationDto) {
    return this.leadService.requestSmsVerification(body);
  }

  /**
   * POST /api/lead/verify-sms
   * Called by the gateway to exchange a 6-digit SMS code for a verification JWT.
   */
  @ApiOperation({ summary: 'Verify an SMS code and issue a verification token (internal)' })
  @ApiResponse({ status: 200, description: 'Verification result returned' })
  @UseGuards(InternalApiKeyGuard)
  @Post('verify-sms')
  @HttpCode(200)
  async verifySms(@Body() body: VerifySmsDto) {
    return this.leadService.verifySmsCode(body);
  }

  /**
   * GET /api/lead/kvkk-consent/:botId/:chatId
   * Cheap idempotent probe consumed by the gateway's pre-agent PII scrub
   * (P0 Item 3 of the 2026-07-29 security plan). Returns `{fresh: boolean}`
   * — true iff a LeadPrivacyConsent row exists for this (botId, chatId)
   * within the same 60-minute freshness window that gates the SMS OTP
   * request. Never leaks PII (row id / timestamps / phone are all withheld).
   */
  @ApiOperation({ summary: 'Check whether a fresh KVKK consent exists for a (botId, chatId) pair (internal)' })
  @ApiResponse({ status: 200, description: 'Boolean freshness flag' })
  @UseGuards(InternalApiKeyGuard)
  @Get('kvkk-consent/:botId/:chatId')
  async kvkkConsentStatus(@Param('botId') botId: string, @Param('chatId') chatId: string) {
    return this.leadService.hasFreshKvkkConsent(botId, chatId);
  }

  //#region list
  @ApiOperation({ summary: 'List leads for a bot' })
  @ApiResponse({ status: 200, description: 'Leads returned' })
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('list')
  async list(@Body() body: ListLeadsDto, @Req() req: Request) {
    const user = req.user as IUser;
    return this.leadService.list(body, user.teamId);
  }
  //#endregion

  //#region markStatus
  @ApiOperation({ summary: 'Mark a lead as read or archived' })
  @ApiResponse({ status: 200, description: 'Lead status updated' })
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('markStatus')
  async markStatus(@Body() body: MarkLeadStatusDto, @Req() req: Request) {
    const user = req.user as IUser;
    return this.leadService.markStatus(body, user.teamId);
  }
  //#endregion
}
