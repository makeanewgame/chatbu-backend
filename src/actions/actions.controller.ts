import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { IUser } from 'src/util/interfaces';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { DeleteActionDto } from './dto/delete-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';

@ApiTags('Bot Actions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('actions')
export class ActionsController {
    constructor(private actionsService: ActionsService) { }

    @ApiOperation({ summary: 'List all actions for a bot' })
    @ApiQuery({ name: 'botId', required: true })
    @Get('list')
    list(@Query('botId') botId: string, @Req() req: any) {
        const user = req.user as IUser;
        return this.actionsService.listByBot(botId, user.teamId);
    }

    @ApiOperation({ summary: 'Create a new bot action' })
    @Post('create')
    create(@Body() dto: CreateActionDto, @Req() req: any) {
        const user = req.user as IUser;
        return this.actionsService.create(user.teamId, dto);
    }

    @ApiOperation({ summary: 'Update an existing bot action' })
    @Post('update')
    update(@Body() dto: UpdateActionDto, @Req() req: any) {
        const user = req.user as IUser;
        return this.actionsService.update(user.teamId, dto);
    }

    @ApiOperation({ summary: 'Delete a bot action' })
    @Post('delete')
    remove(@Body() dto: DeleteActionDto, @Req() req: any) {
        const user = req.user as IUser;
        return this.actionsService.remove(dto.id, user.teamId);
    }
}
