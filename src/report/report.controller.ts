import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { IUser } from 'src/util/interfaces';

@ApiTags('Repots Services')
@Controller('report')
export class ReportController {

    constructor(private readonly reportService: ReportService) { }

    //#region chatHistory-List
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
        return this.reportService.getChatHistory(user.teamId);
    }
    //#endregion

    //#region chatHistory-Detail
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
        return this.reportService.getChatHistoryDetail(user.teamId, chatId);
    }
    //#endregion

    //#region user-Usage
    @ApiOperation({ summary: 'Get user quota usage for uploaded file,comsumed token, and created bots' })
    @ApiResponse({
        status: 200,
        description: 'List user usage',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @Get('user/usage')
    @UseGuards(AccessTokenGuard)
    async getUserUsage(@Req() req: Request) {
        const user = req.user as IUser;
        return this.reportService.getUserUsage(user.teamId);
    }
    //#endregion

    //#region geo-locations
    @ApiOperation({ summary: 'Get geo locations for completed chats' })

    @ApiResponse({
        status: 200,
        description: 'List geo locations',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()

    @Get('geoLocations')
    @UseGuards(AccessTokenGuard)
    async getGeoLocations(@Req() req: Request) {
        const user = req.user as IUser;
        return this.reportService.getGeoLocations(user.teamId);
    }
    //#endregion

    //#region token-usage-details
    @ApiOperation({ summary: 'Get detailed token usage logs with breakdown by operation type' })
    @ApiResponse({
        status: 200,
        description: 'Token usage details with summary',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    @ApiQuery({ name: 'botId', required: false, type: String })
    @ApiQuery({ name: 'operationType', required: false, type: String })
    @Get('token-usage/details')
    @UseGuards(AccessTokenGuard)
    async getTokenUsageDetails(
        @Req() req: Request,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('botId') botId?: string,
        @Query('operationType') operationType?: string,
    ) {
        const user = req.user as IUser;
        return this.reportService.getTokenUsageDetails(user.teamId, startDate, endDate, botId, operationType);
    }
    //#endregion
}