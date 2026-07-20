import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { IUser } from 'src/util/interfaces';
import { CompleteMetaConnectionDto } from './dto/complete-meta-connection.dto';
import { ExchangeMetaCodeDto } from './dto/exchange-meta-code.dto';
import { MetaEmbeddedService } from './meta-embedded.service';

@ApiTags('Meta Embedded (Messenger + Instagram)')
@Controller('integration/meta-embedded')
@UseGuards(AccessTokenGuard)
export class MetaEmbeddedController {
    constructor(private readonly service: MetaEmbeddedService) { }

    /**
     * POST /api/integration/meta-embedded/exchange
     * Exchanges the Facebook Login for Business authorization code for the list of
     * Pages (and linked Instagram accounts) the user granted access to.
     */
    @ApiOperation({ summary: 'Exchange Meta authorization code for connectable Pages' })
    @ApiBearerAuth()
    @Post('exchange')
    async exchange(@Body() body: ExchangeMetaCodeDto) {
        return this.service.exchangeCode(body.chatbotId, body.authorizationCode);
    }

    /**
     * POST /api/integration/meta-embedded/complete
     * Subscribes to the selected Page's webhooks and persists the requested channels.
     */
    @ApiOperation({ summary: 'Complete Meta Embedded connection for the selected Page' })
    @ApiBearerAuth()
    @Post('complete')
    async complete(@Req() req, @Body() body: CompleteMetaConnectionDto) {
        const user = req.user as IUser;
        return this.service.completeConnection(user.teamId, body);
    }

    /**
     * GET /api/integration/meta-embedded/:chatbotId/status
     */
    @ApiOperation({ summary: 'Get Messenger + Instagram connection status for a chatbot' })
    @ApiBearerAuth()
    @Get(':chatbotId/status')
    async getStatus(@Req() req, @Param('chatbotId') chatbotId: string) {
        const user = req.user as IUser;
        return this.service.getStatus(user.teamId, chatbotId);
    }

    /**
     * DELETE /api/integration/meta-embedded/:chatbotId/:channel
     */
    @ApiOperation({ summary: 'Disconnect a Messenger or Instagram channel for a chatbot' })
    @ApiBearerAuth()
    @Delete(':chatbotId/:channel')
    async disconnect(@Req() req, @Param('chatbotId') chatbotId: string, @Param('channel') channel: 'messenger' | 'instagram') {
        const user = req.user as IUser;
        return this.service.disconnectChannel(user.teamId, chatbotId, channel);
    }
}
