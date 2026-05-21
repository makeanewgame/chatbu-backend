import { Body, Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Meta Integration Callback')
@Controller('integrations/meta')
export class MetaIntegrationController {
    private readonly logger = new Logger(MetaIntegrationController.name);

    @ApiOperation({ summary: 'Facebook Meta callback mock endpoint (GET)' })
    @Get('callback')
    @HttpCode(200)
    handleGetCallback(@Query() query: Record<string, any>) {
        this.logger.log('Received GET /api/integrations/meta/callback request');

        return {
            success: true,
            mock: true,
            method: 'GET',
            path: '/api/integrations/meta/callback',
            message: 'Meta callback mock endpoint is active.',
            received: {
                query,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta callback mock endpoint (POST)' })
    @Post('callback')
    @HttpCode(200)
    handlePostCallback(
        @Query() query: Record<string, any>,
        @Body() body: Record<string, any>,
    ) {
        this.logger.log('Received POST /api/integrations/meta/callback request');

        return {
            success: true,
            mock: true,
            method: 'POST',
            path: '/api/integrations/meta/callback',
            message: 'Meta callback mock endpoint is active.',
            received: {
                query,
                body,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta deauthorize mock endpoint (GET)' })
    @Get('deauthorize')
    @HttpCode(200)
    handleGetDeauthorize(@Query() query: Record<string, any>) {
        this.logger.log('Received GET /api/integrations/meta/deauthorize request');

        return {
            success: true,
            mock: true,
            method: 'GET',
            path: '/api/integrations/meta/deauthorize',
            message: 'Meta deauthorize mock endpoint is active.',
            received: {
                query,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta deauthorize mock endpoint (POST)' })
    @Post('deauthorize')
    @HttpCode(200)
    handlePostDeauthorize(
        @Query() query: Record<string, any>,
        @Body() body: Record<string, any>,
    ) {
        this.logger.log('Received POST /api/integrations/meta/deauthorize request');

        return {
            success: true,
            mock: true,
            method: 'POST',
            path: '/api/integrations/meta/deauthorize',
            message: 'Meta deauthorize mock endpoint is active.',
            received: {
                query,
                body,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta data deletion mock endpoint (GET)' })
    @Get('data-deletion')
    @HttpCode(200)
    handleGetDataDeletion(@Query() query: Record<string, any>) {
        this.logger.log('Received GET /api/integrations/meta/data-deletion request');

        return {
            success: true,
            mock: true,
            method: 'GET',
            path: '/api/integrations/meta/data-deletion',
            message: 'Meta data deletion mock endpoint is active.',
            received: {
                query,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta data deletion mock endpoint (POST)' })
    @Post('data-deletion')
    @HttpCode(200)
    handlePostDataDeletion(
        @Query() query: Record<string, any>,
        @Body() body: Record<string, any>,
    ) {
        this.logger.log('Received POST /api/integrations/meta/data-deletion request');

        return {
            success: true,
            mock: true,
            method: 'POST',
            path: '/api/integrations/meta/data-deletion',
            message: 'Meta data deletion mock endpoint is active.',
            received: {
                query,
                body,
            },
        };
    }
}
