import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { InternalApiKeyGuard } from 'src/integration/google-calendar/internal-api-key.guard';
import { Request, Response } from 'express';
import { CreateBotRequest } from './dto/createBotRequest';
import { GenerateSystemPromptRequest } from './dto/generateSystemPromptRequest';
import { FetchSingleBotRequest } from './dto/fetchSingleBot';
import { UpdateSettingsRequest } from './dto/updateSettingsRequest';
import { BotService } from './bot.service';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import {
  ChageStatusBotRequest,
  ChageStatusBotResponse,
} from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';
import { UpdateModelTierRequest } from './dto/updateModelTierRequest';
import { UpdateLeadDestinationsRequest } from './dto/updateLeadDestinationsRequest';
import { UpdateLeadVerificationRequest } from './dto/updateLeadVerificationRequest';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IUser } from 'src/util/interfaces';

@ApiTags('Chat Bot Operations')
@Controller('bot')
export class BotController {
  constructor(private botService: BotService) { }


  //#region createBot
  @ApiOperation({ summary: 'Create a new bot' })
  @ApiResponse({
    status: 201,
    description: 'Bot created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botName: { type: 'string' },
        botType: { type: 'string' },
        userId: { type: 'string' },
        botId: { type: 'string' },
      },
      required: ['botName', 'botType', 'userId'],
    },
  })
  @Post('create')
  @UseGuards(AccessTokenGuard)
  async createBot(@Body() body: CreateBotRequest, @Req() req: Request) {
    const user = req.user as IUser;
    return this.botService.createBot(body, user.sub, user.email);
  }
  //#endregion

  //#region generateSystemPrompt
  @ApiOperation({ summary: 'Generate a draft chatbot system prompt via LLM, for the user to review before creating the bot' })
  @ApiResponse({
    status: 200,
    description: 'System prompt generated successfully',
  })
  @ApiBearerAuth()
  @Post('generateSystemPrompt')
  @UseGuards(AccessTokenGuard)
  async generateSystemPrompt(@Body() body: GenerateSystemPromptRequest) {
    return this.botService.generateSystemPrompt(body);
  }
  //#endregion

  //#region deleteBot
  @ApiOperation({ summary: 'Delete a bot' })
  @ApiResponse({
    status: 200,
    description: 'Bot deleted successfully',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
      },
      required: ['botId'],
    },
  })
  @Post('delete')
  @UseGuards(AccessTokenGuard)
  async deleteBot(@Body() body: DeleteBotRequest, @Req() req: Request) {
    const user = req.user as IUser;
    return this.botService.deleteBot(body, user.sub, user.email);
  }
  //#endregion

  // #region Post getBotList
  @ApiOperation({ summary: 'List all bots for a user' })
  @ApiResponse({
    status: 200,
    description: 'List of bots',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiParam({
    name: 'user',
    description: 'User ID in uuid format',
    required: true,
    type: String,
  })

  @Post('list')
  @UseGuards(AccessTokenGuard)
  async getBotSettings(@Body() body: FetchSingleBotRequest) {
    const botId = body.botId;
    if (!botId) {
      throw new BadRequestException('Bot ID is required');
    }
    const bot = await this.botService.botDetail(botId);
    if (!bot) {
      throw new ForbiddenException("You don't have access to this bot");
    }
    return bot;
  }
  //#endregion

  //#region Get listBots
  @ApiOperation({ summary: 'List all bots for a user' })
  @ApiResponse({
    status: 200,
    description: 'List of bots',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiParam({
    name: 'user',
    description: 'User ID in uuid format',
    required: true,
    type: String,
  })
  @Get('list')
  @UseGuards(AccessTokenGuard)
  async listBots(@Req() req: Request) {
    const user = req.user as IUser;
    return this.botService.listBots(user.teamId);
  }
  //#endregion

  //#region renameBot
  @ApiOperation({ summary: 'Rename a bot' })
  @ApiResponse({
    status: 200,
    description: 'Bot renamed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        newName: { type: 'string' },
      },
      required: ['botId', 'newName'],
    },
  })
  @Post('rename')
  @UseGuards(AccessTokenGuard)
  async renameBot(@Body() body: RenameBotRequest, @Req() req: Request) {
    const user = req.user as IUser;
    return this.botService.renameBot(body, user.sub, user.email);
  }
  //#endregion

  //#region changeStatus
  @ApiOperation({ summary: 'Change bot status' })
  @ApiResponse({
    status: 200,
    description: 'Bot status changed',
    type: ChageStatusBotResponse,
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @Post('changeStatus')
  @UseGuards(AccessTokenGuard)
  async changeStatus(@Body() body: ChageStatusBotRequest) {
    return this.botService.changeStatus(body);
  }
  //#endregion

  //#region chat
  @ApiOperation({ summary: 'Chat with the bot' })
  @ApiResponse({
    status: 200,
    description: 'Chat response from the bot',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        userId: { type: 'string' },
        message: { type: 'string' },
        context: { type: 'string' },
        history: { type: 'array', items: { type: 'object' } },
      },
      required: ['botId', 'userId', 'message'],
    },
  })
  @Post('chat')
  @UseGuards(AccessTokenGuard)
  async chat(@Body() body: any, @Req() req: Request) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log('User IP: ', ip);


    // return res.status(503).json({
    //   message: 'Service is not available',
    // });

    return this.botService.chat(body, ip.toString());
  }
  //#endregion

  //#region getBotApperance

  @ApiOperation({ summary: 'Get bot appearance settings' })
  @ApiResponse({
    status: 200,
    description: 'Bot appearance settings',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        teamId: { type: 'string' },
        message: { type: 'string' },
        context: { type: 'string' },
        history: { type: 'array', items: { type: 'object' } },
      },
      required: ['botId', 'teamId', 'message'],
    },
  })
  @Post('getAppearance')
  @UseGuards(AccessTokenGuard)
  async getBotAppearance(@Body() body: any, @Req() req: Request) {
    const user = req.user as IUser;
    if (!body?.botId) {
      return { id: null, settings: null, missing: true };
    }
    return this.botService.getBotAppearance(body.botId, user.teamId);
  }
  //#endregion

  //#region saveBotAppearance
  @ApiOperation({ summary: 'Save bot appearance settings' })
  @ApiResponse({
    status: 200,
    description: 'Bot appearance settings saved',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },

        settings: { type: 'object' },
      },
      required: ['botId', 'settings'],
    },
  })
  @Post('saveAppearance')
  @UseGuards(AccessTokenGuard)
  async saveBotAppearance(
    @Body() body: UpdateSettingsRequest,
    @Req() req: Request,
  ) {
    const user = req.user as IUser;
    return this.botService.saveBotAppearance(
      user.sub,
      body.botId,
      body.settings,
    );
  }
  //#endregion

  //#region getPublicSettings
  @ApiOperation({ summary: 'Get public bot settings via embed token' })
  @ApiResponse({ status: 200, description: 'Bot settings' })
  @Get('settings')
  async getPublicBotSettings(@Query('token') token: string) {
    if (!token) throw new BadRequestException('token is required');
    return this.botService.getPublicBotSettings(token);
  }
  //#endregion

  //#region publicChat
  @ApiOperation({ summary: 'Public chat endpoint for embedded bots' })
  @ApiResponse({ status: 200, description: 'Chat response' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        message: { type: 'string' },
        chatId: { type: 'string' },
      },
      required: ['token', 'message'],
    },
  })
  @Post('embed/chat')
  async publicChat(@Body() body: any, @Req() req: Request) {
    const ip = (req as any).headers['x-forwarded-for'] || (req as any).socket?.remoteAddress || '127.0.0.1';
    return this.botService.publicChat(
      body.token,
      body.message,
      body.chatId,
      ip.toString(),
    );
  }
  //#endregion

  //#region checkIntegration
  @ApiOperation({ summary: 'Check bot integration' })
  @ApiResponse({
    status: 200,
    description: 'Bot integration status',
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
      },
      required: ['botId', 'userId', 'integrationType'],
    },
  })
  @Post('checkIntegration')
  async checkIntegration(@Body() body: any) {

    return this.botService.checkIntegration(
      body.botId,
    );
  }
  //#endregion

  //#region generateEmbedToken
  // @ApiOperation({ summary: 'Generate embed token for bot' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Embed token generated successfully',
  // })
  // @ApiBadRequestResponse({
  //   description: 'Bad request in payload',
  // })
  // @ApiBearerAuth()
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       botId: { type: 'string' },
  //       userId: { type: 'string' },
  //       integrationType: { type: 'string' },
  //     },
  //     required: ['botId', 'userId', 'integrationType'],
  //   },
  // })
  // @Post('generateEmbedToken')
  // @UseGuards(AccessTokenGuard)
  // async generateEmbedToken(
  //   @Body() body: any,
  //   @Req() req: Request,
  // ): Promise<{ token: string }> {
  //   const user = req.user as IUser;
  //   if (!body.botId || !body.integrationType) {
  //     throw new BadRequestException('Bot ID and integration type are required');
  //   }
  //   return this.botService.generateEmbedToken(
  //     body.botId,
  //     user.sub,
  //   );
  // }
  //#endregion
  //#region updateModelTier
  @ApiOperation({ summary: 'Update bot model tier' })
  @ApiResponse({ status: 200, description: 'Model tier updated' })
  @ApiBadRequestResponse({ description: 'Invalid model tier or plan upgrade required' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        modelTier: { type: 'string', enum: ['haiku', 'sonnet'] },
      },
      required: ['botId', 'modelTier'],
    },
  })
  @Post('updateModelTier')
  @UseGuards(AccessTokenGuard)
  async updateModelTier(@Body() body: UpdateModelTierRequest, @Req() req: Request) {
    const user = req.user as IUser;
    return this.botService.updateModelTier(body, user.teamId, user.sub, user.email);
  }
  //#endregion

  //#region updateLeadDestinations
  @ApiOperation({ summary: 'Update bot lead notification destinations' })
  @ApiResponse({ status: 200, description: 'Lead destinations updated' })
  @ApiBadRequestResponse({ description: 'Invalid destinations payload' })
  @ApiBearerAuth()
  @Post('updateLeadDestinations')
  @UseGuards(AccessTokenGuard)
  async updateLeadDestinations(
    @Body() body: UpdateLeadDestinationsRequest,
    @Req() req: Request,
  ) {
    const user = req.user as IUser;
    return this.botService.updateLeadDestinations(body, user.teamId, user.sub, user.email);
  }
  //#endregion

  //#region updateLeadVerification
  @ApiOperation({ summary: 'Toggle required email verification for bot leads' })
  @ApiResponse({ status: 200, description: 'Lead verification setting updated' })
  @ApiBearerAuth()
  @Post('updateLeadVerification')
  @UseGuards(AccessTokenGuard)
  async updateLeadVerification(
    @Body() body: UpdateLeadVerificationRequest,
    @Req() req: Request,
  ) {
    const user = req.user as IUser;
    return this.botService.updateLeadVerification(body, user.teamId, user.sub, user.email);
  }
  //#endregion

  //#region verificationStatus
  /**
   * GET /api/bot/verification-status/:botId
   * MCP-facing endpoint. Returns whether the bot requires lead-capture email verification.
   */
  @ApiOperation({ summary: 'Get lead verification requirement for bot (internal)' })
  @ApiResponse({ status: 200, description: 'Requirement flag returned' })
  @UseGuards(InternalApiKeyGuard)
  @Get('verification-status/:botId')
  async getVerificationStatus(@Param('botId') botId: string) {
    return this.botService.getLeadVerificationStatus(botId);
  }
  //#endregion

  //#region retrievalSettings
  /**
   * GET /api/bot/retrieval-settings/:botId
   *
   * FastAPI-gateway-facing endpoint (guarded by the same internal-key
   * pattern as `verification-status`). Returns per-bot query-time URL
   * globs read from `CustomerBots.settings`:
   *   - queryUrlAllowGlobs — allow filter
   *   - queryUrlDenyGlobs  — deny filter
   *   - queryUrlBoostGlobs — soft preference boost
   *
   * Consumed by RetrievalMiddleware's hybrid path (Phase D-2 of the
   * retrieval quality overhaul plan). Gateway caches in-memory 60 s.
   */
  @ApiOperation({ summary: 'Get retrieval URL glob preferences for bot (internal)' })
  @ApiResponse({ status: 200, description: 'Retrieval settings returned' })
  @UseGuards(InternalApiKeyGuard)
  @Get('retrieval-settings/:botId')
  async getRetrievalSettings(@Param('botId') botId: string) {
    return this.botService.getRetrievalSettings(botId);
  }
  //#endregion
}
