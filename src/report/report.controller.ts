import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { IUser } from 'src/util/interfaces';

@ApiTags('Repots Services')
@Controller('report')
export class ReportController {

    constructor(private readonly reportService: ReportService) { }

    @ApiOperation({ summary: 'List chat history for user' })
    @ApiResponse({
        status: 200,
        description: 'List chat history',
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
    @Get('chatHistory/list')
    @UseGuards(AccessTokenGuard)
    async getChatHistory(@Req() req: Request) {
        const user = req.user as IUser;
        return this.reportService.getChatHistory(user.sub);
    }


    @ApiOperation({ summary: 'Get chat history detail for user and chat' })
    @ApiResponse({
        status: 200,
        description: 'List chat history details',
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
    },)
    @ApiParam({
        name: 'chatId',
        description: 'Chat ID in uuid format',
        required: true,
        type: String,
    })
    @Get('chatHistory/detail/:chatId')
    @UseGuards(AccessTokenGuard)
    async getChatHistoryDetail(@Req() req: Request, @Param('chatId') chatId: string) {
        const user = req.user as IUser;
        return this.reportService.getChatHistoryDetail(user.sub, chatId);
    }




}