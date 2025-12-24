import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { CreateBotRequest } from 'src/bot/dto/createBotRequest';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
    constructor(private adminService: AdminService) { }

    //#region getAllUsers
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
        return this.adminService.getAllUsers();
    }
    //#endregion
}
