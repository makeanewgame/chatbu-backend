import { Body, Controller, Get, HttpCode, Logger, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetaService } from './meta.service';

@ApiTags('Meta Webhook')
@Controller('meta')
export class MetaController {
    private readonly logger = new Logger(MetaController.name);

    constructor(private readonly metaService: MetaService) { }

    @ApiOperation({ summary: 'Facebook webhook verification (GET hub.challenge)' })
    @Get('webhook')
    async verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') verifyToken: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        try {
            const result = await this.metaService.verifyWebhook(mode, verifyToken, challenge);
            res.status(200).send(result);
        } catch {
            res.status(403).send('Forbidden');
        }
    }

    @ApiOperation({ summary: 'Facebook webhook message receiver' })
    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(@Body() body: any) {
        await this.metaService.handleWebhook(body);
        return 'EVENT_RECEIVED';
    }
}
