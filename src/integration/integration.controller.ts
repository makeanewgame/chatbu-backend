import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { IUser } from 'src/util/interfaces';
import { IntegrationService } from './integration.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { DeleteIntegrationDto } from './dto/delete-integration.dto';

@ApiTags('Integration Services')
@Controller('integration')
@UseGuards(AccessTokenGuard)
export class IntegrationController {
    constructor(private readonly integrationService: IntegrationService) { }

    @ApiOperation({ summary: 'List integrations for team' })
    @ApiResponse({ status: 200, description: 'List integrations' })
    @ApiBearerAuth()
    @Post('list')
    async list(@Req() req) {
        const user = req.user as IUser;
        return this.integrationService.listIntegrations(user.teamId);
    }

    @ApiOperation({ summary: 'Create integration for team' })
    @ApiResponse({ status: 201, description: 'Integration created' })
    @ApiBearerAuth()
    @Post()
    async create(@Req() req, @Body() body: CreateIntegrationDto) {
        const user = req.user as IUser;
        return this.integrationService.createIntegration(user.teamId, body);
    }

    @ApiOperation({ summary: 'Update integration for team' })
    @ApiResponse({ status: 200, description: 'Integration updated' })
    @ApiBearerAuth()
    @Post('update')
    async update(@Req() req, @Body() body: UpdateIntegrationDto) {
        const user = req.user as IUser;
        return this.integrationService.updateIntegration(user.teamId, body);
    }

    @ApiOperation({ summary: 'Delete integration for team' })
    @ApiResponse({ status: 200, description: 'Integration deleted' })
    @ApiBearerAuth()
    @Post('delete')
    async delete(@Req() req, @Body() body: DeleteIntegrationDto) {
        const user = req.user as IUser;
        return this.integrationService.deleteIntegration(user.teamId, body);
    }
}
