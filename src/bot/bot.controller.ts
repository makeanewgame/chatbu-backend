import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { CreateBotRequest } from './dto/createBotRequest';
import { BotService } from './bot.service';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import { ChageStatusBotRequest, ChageStatusBotResponse } from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOAuth2, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Chat Bot Operations')
@Controller('bot')
export class BotController {
    constructor(private botService: BotService) { }

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
    async chat(@Body() body: any, @Req() req: Request) {

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log("User IP: ", ip);

        return this.botService.chat(body, ip.toString());
    }
}
