import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { CreateBotRequest } from './dto/createBotRequest';
import { BotService } from './bot.service';
import { DeleteBotRequest } from './dto/deleteBotRequest';
import { ChageStatusBotRequest } from './dto/changeStatusBotRequest';
import { RenameBotRequest } from './dto/renameBotRequest';

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

    @Post('changeStatus')
    @UseGuards(AccessTokenGuard)
    async changeStatus(@Body() body: ChageStatusBotRequest) {
        return this.botService.changeStatus(body);
    }


}
