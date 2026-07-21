import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ContentService } from './content.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IUser } from 'src/util/interfaces';

// Every route here sits behind AccessTokenGuard — these are authenticated
// admin operations (a bot owner managing their content), not abuse-prone
// public surface. The global 100-req/60s throttle was meant to cap anonymous
// chat traffic, but it kicks in when a bot owner deletes/re-ingests their
// content list (a 313-URL Eot Klinik delete on chatbu-dev 2026-06-27 hit
// ThrottlerException after ~100 URLs). The auth gate already prevents abuse;
// skip the throttle for the whole controller.
@SkipThrottle()
@Controller('content')
export class ContentController {
    constructor(
        private contentService: ContentService, // Assuming you have a ContentService to handle content-related logic
    ) { }

    //#region createContent
    @ApiOperation({ summary: 'Creta user vault content for specific types' })
    @ApiOperation({ summary: 'Create content' })
    @ApiResponse({
        status: 201,
        description: 'Content created successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                type: { type: 'string' },
                content: { type: 'object' },
                status: { type: 'string' },
                taskId: { type: 'string' },
                ingestInfo: { type: 'string' },
            },
            required: ['botId', 'type', 'content'],
        },
    })
    @Post('create')
    @UseGuards(AccessTokenGuard)

    async createContent(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.createContent(body, user);
    }
    //#endregion

    //#region getContent
    @ApiOperation({ summary: 'Get user vault content for specific types' })
    @ApiResponse({
        status: 200,
        description: 'List user uploaded documents',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                type: { type: 'string' },
            },
            required: ['botId', 'type'],
        },
    })
    @Post('getContents')
    @UseGuards(AccessTokenGuard)
    async getContent(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.getContent(user, body.botId, body.type);
    }
    //#endregion

    //#region deleteContent
    @ApiOperation({ summary: 'Delete user vault content for specific types' })
    @ApiResponse({
        status: 200,
        description: 'Content deleted successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                type: { type: 'string' },
                contentId: { type: 'string' },
                sourceId: { type: 'string' },
            },
            required: ['botId', 'type', 'contentId', 'sourceId'],
        },
    })
    @Post('delete')
    @UseGuards(AccessTokenGuard)
    async deleteContent(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.deleteContent(user, body.contentId, body.botId, body.sourceId);
    }
    //#endregion

    //#region deleteAllContent
    @ApiOperation({ summary: 'Bulk delete user vault content' })
    @ApiResponse({
        status: 200,
        description: 'Content deletion started',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                contentIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['botId', 'contentIds'],
        },
    })
    @Post('deleteAll')
    @UseGuards(AccessTokenGuard)
    async deleteAllContent(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.deleteAllContent(user, body.contentIds, body.botId);
    }
    //#endregion

    //#region editContent
    @ApiOperation({ summary: 'Edit user vault content for specific types' })
    @ApiResponse({
        status: 200,
        description: 'Content edited successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                type: { type: 'string' },
                contentId: { type: 'string' },
                content: { type: 'object' },
            },
            required: ['botId', 'type', 'contentId', 'content'],
        },
    })
    @Post('edit')
    @UseGuards(AccessTokenGuard)
    async editContent(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.editContent(body, user);
    }
    //#endregion

    //#region fetchSitemap
    @ApiOperation({ summary: 'Fetch sitemap URLs from a domain' })
    @ApiResponse({
        status: 200,
        description: 'Sitemap URLs fetched successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                domain: { type: 'string' },
            },
            required: ['domain'],
        },
    })
    @Post('fetchSitemap')
    @UseGuards(AccessTokenGuard)
    async fetchSitemap(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.fetchSitemap(body.domain);
    }
    //#endregion

    //#region classifySitemapPages
    @ApiOperation({ summary: 'Classify sitemap URLs into page categories (Home/About/Services/...)' })
    @ApiResponse({
        status: 200,
        description: 'URLs classified successfully',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                urls: { type: 'array', items: { type: 'string' } },
            },
            required: ['urls'],
        },
    })
    @Post('classifySitemapPages')
    @UseGuards(AccessTokenGuard)
    async classifySitemapPages(@Body() body: any) {
        return this.contentService.classifySitemapPages(body.urls ?? []);
    }
    //#endregion

    //#region extractBrandTheme
    @ApiOperation({ summary: "Best-effort extraction of a website's primary brand color and logo" })
    @ApiResponse({
        status: 200,
        description: 'Brand theme extracted (fields may be null if not detected)',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
            },
            required: ['url'],
        },
    })
    @Post('extractBrandTheme')
    @UseGuards(AccessTokenGuard)
    async extractBrandTheme(@Body() body: any) {
        return this.contentService.extractBrandTheme(body.url);
    }
    //#endregion

    //#region ingestWebPages
    @ApiOperation({ summary: 'Ingest multiple web pages' })
    @ApiResponse({
        status: 200,
        description: 'Web pages ingestion started',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                urls: { type: 'array', items: { type: 'string' } },
            },
            required: ['botId', 'urls'],
        },
    })
    @Post('ingestWebPages')
    @UseGuards(AccessTokenGuard)
    async ingestWebPages(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.ingestWebPages(body, user);
    }
    //#endregion

    //#region getQuota
    @ApiOperation({ summary: 'Get user FILE quota information' })
    @ApiResponse({
        status: 200,
        description: 'Quota information retrieved',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @Post('getQuota')
    @UseGuards(AccessTokenGuard)
    async getQuota(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.getQuota(user.teamId);
    }
    //#endregion

    //#region reIngestContents
    @ApiOperation({ summary: 'Re-ingest selected web page or link content items' })
    @ApiResponse({
        status: 200,
        description: 'Re-ingestion started',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                contentIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['botId', 'contentIds'],
        },
    })
    @Post('reIngestContents')
    @UseGuards(AccessTokenGuard)
    async reIngestContents(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.reIngestContents(user, body.contentIds, body.botId);
    }
    //#endregion

    //#region getIngestBatch (Phase B-3)
    @ApiOperation({ summary: 'Get per-URL outcome for an ingest batch by task_id' })
    @ApiResponse({
        status: 200,
        description: 'Batch summary with per-URL status + audit trail',
    })
    @ApiBearerAuth()
    @Get('ingestBatch/:taskId')
    @UseGuards(AccessTokenGuard)
    async getIngestBatch(@Param('taskId') taskId: string, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.getIngestBatch(user, taskId);
    }
    //#endregion

}