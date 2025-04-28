import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { CreateBotRequest } from './dto/createBotRequest';
import { FetchSingleBotRequest } from './dto/fetchSingleBot';
import { UpdateSettingsRequest } from './dto/updateSettingsRequest';
import { BotService } from './bot.service';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import {
  ChageStatusBotRequest,
  ChageStatusBotResponse,
} from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';
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
  async createBot(@Body() body: CreateBotRequest) {
    return this.botService.createBot(body);
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
  async deleteBot(@Body() body: DeleteBotRequest) {
    return this.botService.deleteBot(body);
  }
  @Post('update-settings')
  @UseGuards(AccessTokenGuard)
  async updateSettings(@Body() body: UpdateSettingsRequest) {
    return this.botService.updateSettings(body);
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
    const { user } = req.query;
    return this.botService.listBots(user.toString());
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
  async renameBot(@Body() body: RenameBotRequest) {
    return this.botService.renameBot(body);
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
        userId: { type: 'string' },
        message: { type: 'string' },
        context: { type: 'string' },
        history: { type: 'array', items: { type: 'object' } },
      },
      required: ['botId', 'userId', 'message'],
    },
  })
  @Post('getAppearance')
  @UseGuards(AccessTokenGuard)
  async getBotAppearance(@Body() body: any, @Req() req: Request) {
    const user = req.user as IUser;
    return this.botService.getBotAppearance(body.botId, user.sub);
  }
  //#endregion
}
