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
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from './guards/admin.guard';
import { GetAllTeamsDto } from './dto/getAllTeams.dto';
import { GetAllUsersDto } from './dto/getAllUsers.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UpdateUserPasswordDto } from './dto/updateUserPassword.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
    constructor(private adminService: AdminService) { }

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
}
