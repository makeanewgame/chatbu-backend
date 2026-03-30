import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SystemLogService, LogQueryParams } from './system-log.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from 'src/admin/guards/admin.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('System Logs')
@Controller('system-logs')
@UseGuards(AccessTokenGuard, AdminGuard)
@ApiBearerAuth()
export class SystemLogController {
    constructor(private systemLogService: SystemLogService) { }

    @ApiOperation({ summary: 'Get all system logs with filtering and pagination (Admin only)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'category', required: false, type: String })
    @ApiQuery({ name: 'action', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String })
    @ApiQuery({ name: 'userId', required: false, type: String })
    @ApiQuery({ name: 'teamId', required: false, type: String })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    @Get()
    async getLogs(@Query() query: LogQueryParams) {
        return this.systemLogService.getLogs(query);
    }

    @ApiOperation({ summary: 'Get a single log entry by ID (Admin only)' })
    @Get(':id')
    async getLogById(@Param('id') id: string) {
        return this.systemLogService.getLogById(id);
    }
}
