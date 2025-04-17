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
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Chat Bot Operations')
@Controller('bot')
export class BotController {
  constructor(private botService: BotService) {}

  @Post('create')
  @UseGuards(AccessTokenGuard)
  async createBot(@Body() body: CreateBotRequest) {
    return this.botService.createBot(body);
  }

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
  // @Post('list')
  // @UseGuards(AccessTokenGuard)
  // async botDetail(@Body() body: FetchSingleBotRequest) {
  //   const botId = body.botId;
  //   return this.botService.botDetail(botId);
  // }
  // @Post('list')
  // @UseGuards(AccessTokenGuard)
  // async getBotSettings(@Body() body: any, @Req() req: Request) {
  //   const userId = req.user.id;

  //   const { botId } = body;

  //   if (!botId) {
  //     throw new BadRequestException('Bot ID is required');
  //   }

  //   const bot = await this.botService.findOne(botId);

  //   if (!bot || bot.userId !== userId) {
  //     throw new ForbiddenException("You don't have access to this bot");
  //   }

  //   return bot;
  // }
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

  @Get('list')
  @UseGuards(AccessTokenGuard)
  async listBots(@Req() req: Request) {
    const { user } = req.query;
    return this.botService.listBots(user.toString());
  }
  @Post('rename')
  @UseGuards(AccessTokenGuard)
  async renameBot(@Body() body: RenameBotRequest) {
    return this.botService.renameBot(body);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change bot status' })
  @ApiResponse({
    status: 200,
    description: 'Bot status changed',
    type: ChageStatusBotResponse,
  })
  @ApiBadRequestResponse({
    description: 'Bad request in payload',
  })
  @Post('changeStatus')
  @UseGuards(AccessTokenGuard)
  async changeStatus(@Body() body: ChageStatusBotRequest) {
    return this.botService.changeStatus(body);
  }

  @Post('chat')
  @UseGuards(AccessTokenGuard)
  async chat(@Body() body: any) {
    return this.botService.chat(body);
  }
}
