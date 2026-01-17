import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IUser } from 'src/util/interfaces';

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

}