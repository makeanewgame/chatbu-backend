import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard } from 'src/integration/google-calendar/internal-api-key.guard';
import { ChatFlowService } from './chat-flow.service';

@ApiTags('Chat Flow State')
@Controller('chat-flow')
export class ChatFlowController {
  constructor(private chatFlowService: ChatFlowService) {}

  /**
   * GET /api/chat-flow/:botId/:chatId
   *
   * Gateway-facing probe endpoint. Called on every /chat turn by
   * `app-gateway/utils/chat_flow_probe.py` (Phase 1b of the
   * state-machine plan). Returns the list of active flow rows for
   * this chat so the gateway can inject a "CURRENT STEP" mini-block
   * into the system prompt (Phase 2+).
   *
   * Response shape:
   *   {
   *     "flows": [
   *       {
   *         "flowKind": "LEAD",
   *         "state": "OTP_SENT",
   *         "enteredAt": "2026-07-30T12:34:56.789Z",
   *         "payload": {...} | null
   *       },
   *       ...
   *     ]
   *   }
   *
   * Empty `flows` array means no state on record — gateway falls
   * back to the legacy sentinel-scan path (Phase 4 removes that
   * fallback once state proves authoritative).
   */
  @ApiOperation({ summary: 'Read per-chat flow state (internal, called by gateway)' })
  @ApiResponse({ status: 200, description: 'Flow state rows returned (may be empty)' })
  @UseGuards(InternalApiKeyGuard)
  @Get(':botId/:chatId')
  async list(
    @Param('botId') botId: string,
    @Param('chatId') chatId: string,
  ) {
    const flows = await this.chatFlowService.list(botId, chatId);
    return { flows };
  }
}
