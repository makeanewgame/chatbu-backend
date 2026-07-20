import {
    Body,
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiParam,
    ApiQuery
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { K8sService } from './k8s.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from './guards/admin.guard';
import { GetAllChatbotsDto } from './dto/getAllChatbots.dto';
import { GetAllTeamsDto } from './dto/getAllTeams.dto';
import { GetAllUsersDto } from './dto/getAllUsers.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UpdateUserPasswordDto } from './dto/updateUserPassword.dto';
import { UpdateUserQuotaDto } from './dto/updateUserQuota.dto';
import { CreateAdminUserDto } from './dto/createAdminUser.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
    constructor(
        private adminService: AdminService,
        private k8sService: K8sService,
    ) { }

    //#region getAllTeams
    @ApiOperation({ summary: 'Get all teams (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Teams retrieved successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request',
    })
    @Post('getAllTeams')
    @HttpCode(HttpStatus.OK)
    async getAllTeams(@Body() dto: GetAllTeamsDto) {
        return this.adminService.getAllTeams(dto);
    }
    //#endregion

    //#region getAllUsers
    @ApiOperation({ summary: 'Get all users with filtering and pagination (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Users retrieved successfully',
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'role', required: false, type: String })
    @ApiQuery({ name: 'emailVerified', required: false, type: Boolean })
    @ApiQuery({ name: 'phoneVerified', required: false, type: Boolean })
    @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
    @Get('users')
    async getAllUsers(@Query() query: GetAllUsersDto) {
        return this.adminService.getAllUsers(query);
    }
    //#endregion

    //#region createUser
    @ApiOperation({ summary: 'Create a new user (Admin only)' })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiBadRequestResponse({ description: 'Email already in use or validation error' })
    @ApiBody({ type: CreateAdminUserDto })
    @Post('users')
    @HttpCode(HttpStatus.CREATED)
    async createUser(@Body() dto: CreateAdminUserDto) {
        return this.adminService.createUser(dto);
    }
    //#endregion

    //#region getUserById
    @ApiOperation({ summary: 'Get user by ID (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'User retrieved successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Get('users/:id')
    async getUserById(@Param('id') id: string) {
        return this.adminService.getUserById(id);
    }
    //#endregion

    //#region updateUser
    @ApiOperation({ summary: 'Update user (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'User updated successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiBadRequestResponse({
        description: 'Email or phone already in use',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Patch('users/:id')
    async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.adminService.updateUser(id, dto);
    }
    //#endregion

    //#region updateUserPassword
    @ApiOperation({ summary: 'Update user password (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Password updated successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Patch('users/:id/password')
    async updateUserPassword(
        @Param('id') id: string,
        @Body() dto: UpdateUserPasswordDto
    ) {
        return this.adminService.updateUserPassword(id, dto.password);
    }
    //#endregion

    //#region deleteUser
    @ApiOperation({ summary: 'Soft delete user (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'User deleted successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiBadRequestResponse({
        description: 'User already deleted',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Delete('users/:id')
    async deleteUser(@Param('id') id: string) {
        return this.adminService.deleteUser(id);
    }
    //#endregion

    //#region restoreUser
    @ApiOperation({ summary: 'Restore deleted user (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'User restored successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiBadRequestResponse({
        description: 'User is not deleted',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Patch('users/:id/restore')
    async restoreUser(@Param('id') id: string) {
        return this.adminService.restoreUser(id);
    }
    //#endregion

    //#region verifyUserEmail
    @ApiOperation({ summary: 'Verify user email (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Email verified successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiBadRequestResponse({
        description: 'Email already verified',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Patch('users/:id/verify-email')
    async verifyUserEmail(@Param('id') id: string) {
        return this.adminService.verifyUserEmail(id);
    }
    //#endregion

    //#region verifyUserPhone
    @ApiOperation({ summary: 'Verify user phone (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Phone verified successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'User not found',
    })
    @ApiBadRequestResponse({
        description: 'Phone already verified',
    })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Patch('users/:id/verify-phone')
    async verifyUserPhone(@Param('id') id: string) {
        return this.adminService.verifyUserPhone(id);
    }
    //#endregion

    //#region getUserTeamQuotas
    @ApiOperation({ summary: 'Get quota limits for a user\'s primary team (Admin only)' })
    @ApiResponse({ status: 200, description: 'Quotas retrieved successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @Get('users/:id/quotas')
    async getUserTeamQuotas(@Param('id') id: string) {
        return this.adminService.getUserTeamQuotas(id);
    }
    //#endregion

    //#region updateUserQuota
    @ApiOperation({ summary: 'Update BOT or TOKEN quota limit for a user\'s primary team (Admin only)' })
    @ApiResponse({ status: 200, description: 'Quota updated successfully' })
    @ApiResponse({ status: 404, description: 'User or team not found' })
    @ApiParam({ name: 'id', type: String, description: 'User ID' })
    @ApiBody({ type: UpdateUserQuotaDto })
    @Patch('users/:id/quota')
    async updateUserQuota(@Param('id') id: string, @Body() dto: UpdateUserQuotaDto) {
        return this.adminService.updateUserQuota(id, dto.quotaType, dto.limit);
    }
    //#endregion

    //#region getAllChatbots
    @ApiOperation({ summary: 'Get all chatbots with owner and file info (Admin only)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
    @Get('chatbots')
    async getAllChatbots(@Query() query: GetAllChatbotsDto) {
        return this.adminService.getAllChatbots(query);
    }
    //#endregion

    //#region getAdminFileDownloadUrl
    @ApiOperation({ summary: 'Get presigned download URL for a storage file (Admin only)' })
    @ApiQuery({ name: 'fileId', required: true, type: String, description: 'Storage record ID' })
    @ApiResponse({ status: 200, description: 'Presigned URL generated' })
    @Get('files/download-url')
    async getAdminFileDownloadUrl(@Query('fileId') fileId: string) {
        return this.adminService.getAdminFileDownloadUrl(fileId);
    }
    //#endregion

    //#region getBotDetail
    @ApiOperation({ summary: 'Get bot detail including systemPrompt (Admin only)' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @ApiResponse({ status: 200, description: 'Bot detail retrieved' })
    @Get('chatbots/:id')
    async getBotDetail(@Param('id') id: string) {
        return this.adminService.getBotDetail(id);
    }
    //#endregion

    //#region updateBotSystemPrompt
    @ApiOperation({ summary: 'Update bot system prompt (Admin only)' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @ApiBody({ schema: { properties: { systemPrompt: { type: 'string' } } } })
    @ApiResponse({ status: 200, description: 'System prompt updated' })
    @Patch('chatbots/:id/system-prompt')
    async updateBotSystemPrompt(
        @Param('id') id: string,
        @Body('systemPrompt') systemPrompt: string,
    ) {
        return this.adminService.updateBotSystemPrompt(id, systemPrompt);
    }
    //#endregion

    //#region getBotIngestedData
    @ApiOperation({ summary: 'Get ingested data (Storage + Content) for a bot (Admin only)' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Ingested data retrieved' })
    @Get('chatbots/:id/ingested-data')
    async getBotIngestedData(
        @Param('id') id: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.adminService.getBotIngestedData(
            id,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }
    //#endregion

    //#region getBotCustomerChats
    @ApiOperation({ summary: 'Get customer chats (conversations) for a bot (Admin only)' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @ApiResponse({ status: 200, description: 'Customer chats retrieved' })
    @Get('chatbots/:id/customer-chats')
    async getBotCustomerChats(@Param('id') id: string) {
        return this.adminService.getBotCustomerChats(id);
    }
    //#endregion

    //#region getBotCustomerChatDetail
    @ApiOperation({ summary: 'Get a single customer chat transcript for a bot (Admin only)' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @ApiParam({ name: 'chatId', type: String, description: 'CustomerChats ID' })
    @ApiResponse({ status: 200, description: 'Customer chat detail retrieved' })
    @Get('chatbots/:id/customer-chats/:chatId')
    async getBotCustomerChatDetail(@Param('id') id: string, @Param('chatId') chatId: string) {
        return this.adminService.getBotCustomerChatDetail(id, chatId);
    }
    //#endregion

    //#region getBotVectorData
    @ApiOperation({ summary: 'Get vector DB documents for a bot (Admin only)' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Vector documents retrieved' })
    @Get('chatbots/:id/vector-data')
    async getBotVectorData(
        @Param('id') id: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.adminService.getBotVectorData(
            id,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }
    //#endregion

    //#region hardDeleteBot
    @ApiOperation({ summary: 'Permanently delete a soft-deleted bot and all its data (Admin only)' })
    @ApiResponse({ status: 200, description: 'Bot permanently deleted' })
    @ApiResponse({ status: 400, description: 'Bot must be soft-deleted first' })
    @ApiResponse({ status: 404, description: 'Bot not found' })
    @ApiParam({ name: 'id', type: String, description: 'Bot ID' })
    @Delete('chatbots/:id/hard-delete')
    async hardDeleteBot(@Param('id') id: string) {
        return this.adminService.hardDeleteBot(id);
    }
    //#endregion

    //#region getServicesHealth
    @ApiOperation({ summary: 'Get health status of all backend services (Admin only)' })
    @ApiResponse({ status: 200, description: 'Service health retrieved' })
    @Get('services/health')
    async getServicesHealth() {
        return this.adminService.getServicesHealth();
    }
    //#endregion

    //#region getServiceLogs
    @ApiOperation({ summary: 'Get last pod logs for a service (Admin only)' })
    @ApiParam({ name: 'name', type: String, description: 'Service name (fastapi-gateway | ml-services | minio)' })
    @ApiQuery({ name: 'tail', required: false, type: Number, description: 'Number of log lines (default 50)' })
    @ApiResponse({ status: 200, description: 'Pod logs retrieved' })
    @Get('services/:name/logs')
    async getServiceLogs(
        @Param('name') name: string,
        @Query('tail') tail?: string,
    ) {
        return this.k8sService.getPodLogs(name, tail ? parseInt(tail, 10) : 50);
    }
    //#endregion

    //#region restartService
    @ApiOperation({ summary: 'Restart a K8s deployment (Admin only)' })
    @ApiParam({ name: 'name', type: String, description: 'Service name (fastapi-gateway | ml-services | minio)' })
    @ApiResponse({ status: 200, description: 'Restart initiated' })
    @Post('services/:name/restart')
    @HttpCode(HttpStatus.OK)
    async restartService(@Param('name') name: string) {
        return this.k8sService.restartDeployment(name);
    }
    //#endregion

    //#region Widget Visitor Management
    @ApiOperation({ summary: 'List widget visitors for a bot (Admin only)' })
    @ApiQuery({ name: 'botId', required: true, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Visitors retrieved' })
    @Get('widget/visitors')
    async getWidgetVisitors(
        @Query('botId') botId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.adminService.getWidgetVisitors(
            botId,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    @ApiOperation({ summary: 'Block a widget visitor (Admin only)' })
    @ApiParam({ name: 'id', type: String })
    @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
    @ApiResponse({ status: 200, description: 'Visitor blocked' })
    @Post('widget/visitors/:id/block')
    @HttpCode(HttpStatus.OK)
    async blockWidgetVisitor(@Param('id') id: string, @Body() body: { reason?: string }) {
        return this.adminService.blockWidgetVisitor(id, body.reason);
    }

    @ApiOperation({ summary: 'Unblock a widget visitor (Admin only)' })
    @ApiParam({ name: 'id', type: String })
    @ApiResponse({ status: 200, description: 'Visitor unblocked' })
    @Post('widget/visitors/:id/unblock')
    @HttpCode(HttpStatus.OK)
    async unblockWidgetVisitor(@Param('id') id: string) {
        return this.adminService.unblockWidgetVisitor(id);
    }
    //#endregion
}
