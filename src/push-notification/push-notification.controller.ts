import {
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { PushNotificationService } from './push-notification.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('Push Notifications')
@Controller('push-notifications')
export class PushNotificationController {
    constructor(private pushNotificationService: PushNotificationService) { }

    @ApiOperation({ summary: 'Register (or refresh) an Expo push token for the current user' })
    @ApiResponse({ status: 200, description: 'Push token registered' })
    @ApiBearerAuth()
    @UseGuards(AccessTokenGuard)
    @Post('token')
    @HttpCode(HttpStatus.OK)
    async registerToken(@Request() req, @Body() dto: RegisterPushTokenDto) {
        await this.pushNotificationService.registerToken(req.user.sub, dto);
        return { message: 'Push token registered' };
    }

    @ApiOperation({ summary: 'Unregister an Expo push token for the current user (e.g. on logout)' })
    @ApiResponse({ status: 200, description: 'Push token removed' })
    @ApiBearerAuth()
    @UseGuards(AccessTokenGuard)
    @Delete('token/:token')
    @HttpCode(HttpStatus.OK)
    async removeToken(@Request() req, @Param('token') token: string) {
        await this.pushNotificationService.removeToken(req.user.sub, token);
        return { message: 'Push token removed' };
    }
}
