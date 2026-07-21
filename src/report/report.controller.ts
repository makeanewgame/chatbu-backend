import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { IUser } from 'src/util/interfaces';
import { HandoverChatDto } from './dto/handover-chat.dto';
import { AgentMessageDto } from './dto/agent-message.dto';

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

    //#region handover-chat
    @ApiOperation({ summary: 'Transfer a chat to a human agent' })
    @ApiResponse({ status: 200, description: 'Chat transferred to agent' })
    @ApiBadRequestResponse({ description: 'Bad request in payload' })
    @ApiBearerAuth()
    @ApiParam({ name: 'chatId', description: 'Chat ID', required: true, type: String })
    @ApiBody({ type: HandoverChatDto })
    @Post('handover/:chatId')
    @UseGuards(AccessTokenGuard)
    async handoverChat(@Req() req: Request, @Param('chatId') chatId: string, @Body() body: HandoverChatDto) {
        const user = req.user as IUser;
        const agentUserId = body?.agentUserId ?? (body as any)?.userId ?? (body as any)?.agentId;

        if (!agentUserId || agentUserId === 'undefined') {
            throw new BadRequestException('agentUserId is required');
        }

        return this.reportService.handoverChat(user.teamId, chatId, agentUserId);
    }
    //#endregion

    //#region live-chats
    @ApiOperation({ summary: 'Get live chats assigned to the current agent' })
    @ApiResponse({ status: 200, description: 'List of live chats assigned to agent' })
    @ApiBearerAuth()
    @Get('live-chats')
    @UseGuards(AccessTokenGuard)
    async getLiveChats(@Req() req: Request) {
        const user = req.user as IUser;
        return this.reportService.getLiveChats(user.sub);
    }
    //#endregion

    //#region agent-message
    @ApiOperation({ summary: 'Send a message from agent to customer' })
    @ApiResponse({ status: 200, description: 'Message sent' })
    @ApiBadRequestResponse({ description: 'Bad request in payload' })
    @ApiBearerAuth()
    @ApiParam({ name: 'chatId', description: 'Chat ID', required: true, type: String })
    @ApiBody({ type: AgentMessageDto })
    @Post('agent-message/:chatId')
    @UseGuards(AccessTokenGuard)
    async sendAgentMessage(@Req() req: Request, @Param('chatId') chatId: string, @Body() body: AgentMessageDto) {
        const user = req.user as IUser;

        console.log(req.body, "body.message");

        return this.reportService.sendAgentMessage(user.teamId, chatId, user.sub, req.body.message);
    }
    //#endregion

    //#region close-chat
    @ApiOperation({ summary: 'Close a live chat (sets status to CLOSED)' })
    @ApiResponse({ status: 200, description: 'Chat closed' })
    @ApiBearerAuth()
    @ApiParam({ name: 'chatId', description: 'Chat ID', required: true, type: String })
    @Post('close-chat/:chatId')
    @UseGuards(AccessTokenGuard)
    async closeChat(@Req() req: Request, @Param('chatId') chatId: string) {
        const user = req.user as IUser;
        return this.reportService.closeChat(user.teamId, chatId, user.sub);
    }
    //#endregion

    //#region delete-chat
    @ApiOperation({ summary: 'Delete a chat (soft delete)' })
    @ApiResponse({ status: 200, description: 'Chat deleted' })
    @ApiBearerAuth()
    @ApiParam({ name: 'chatId', description: 'Chat ID', required: true, type: String })
    @Delete('chatHistory/:chatId')
    @UseGuards(AccessTokenGuard)
    async deleteChat(@Req() req: Request, @Param('chatId') chatId: string) {
        const user = req.user as IUser;
        return this.reportService.deleteChat(user.teamId, chatId);
    }
    //#endregion
}
