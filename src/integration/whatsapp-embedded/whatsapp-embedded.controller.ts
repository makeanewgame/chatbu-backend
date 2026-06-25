import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { IUser } from 'src/util/interfaces';
import { CompleteWhatsAppSignupDto } from './dto/complete-whatsapp-signup.dto';
import { WhatsAppEmbeddedService } from './whatsapp-embedded.service';

@ApiTags('WhatsApp Embedded Signup')
@Controller('integration/whatsapp-embedded')
@UseGuards(AccessTokenGuard)
export class WhatsAppEmbeddedController {
    constructor(private readonly service: WhatsAppEmbeddedService) { }

    /**
     * POST /api/integration/whatsapp-embedded/complete
     * Called by the frontend after the user completes Meta Embedded Signup.
     * Exchanges the authorization code, retrieves WABA + phone number details,
     * and persists the integration.
     */
    @ApiOperation({ summary: 'Complete WhatsApp Embedded Signup — exchange auth code' })
    @ApiBearerAuth()
    @Post('complete')
    async complete(@Req() req, @Body() body: CompleteWhatsAppSignupDto) {
        const user = req.user as IUser;
        return this.service.completeSignup(user.teamId, body);
    }

    /**
     * GET /api/integration/whatsapp-embedded/:chatbotId/status
     * Returns the current connection status for a specific chatbot.
     */
    @ApiOperation({ summary: 'Get WhatsApp integration status for a chatbot' })
    @ApiBearerAuth()
    @Get(':chatbotId/status')
    async getStatus(@Req() req, @Param('chatbotId') chatbotId: string) {
        const user = req.user as IUser;
        return this.service.getStatus(user.teamId, chatbotId);
    }

    /**
     * DELETE /api/integration/whatsapp-embedded/:chatbotId
     * Removes the WhatsApp integration for a specific chatbot.
     */
    @ApiOperation({ summary: 'Disconnect WhatsApp integration for a chatbot' })
    @ApiBearerAuth()
    @Delete(':chatbotId')
    async disconnect(@Req() req, @Param('chatbotId') chatbotId: string) {
        const user = req.user as IUser;
        return this.service.disconnect(user.teamId, chatbotId);
    }
}
