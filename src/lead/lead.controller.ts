import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { InternalApiKeyGuard } from 'src/integration/google-calendar/internal-api-key.guard';
import { IUser } from 'src/util/interfaces';
import { LeadService } from './lead.service';
import { SubmitLeadDto } from './dto/submit-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { MarkLeadStatusDto } from './dto/mark-lead-status.dto';

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
