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
            },
            required: ['botId', 'type', 'contentId'],
        },
    })
    @Post('delete')
    @UseGuards(AccessTokenGuard)
    async deleteContent(@Body() body: any, @Req() req: any) {
        const user = req.user as IUser;
        return this.contentService.deleteContent(user, body.contentId);
    }
    //#endregion

    // //region ingestWebPage
    // @ApiOperation({ summary: 'Ingest web page content' })
    // @ApiResponse({
    //     status: 200,
    //     description: 'Web page content ingested successfully',
    // })
    // @ApiBadRequestResponse({
    //     description: 'Bad request in payload',
    // })
    // @ApiBearerAuth()
    // @ApiBody({
    //     schema: {
    //         type: 'object',
    //         properties: {
    //             botId: { type: 'string' },
    //             url: { type: 'string' },
    //             type: { type: 'string' },
    //             content: { type: 'object' },
    //             status: { type: 'string' },
    //             taskId: { type: 'string' },
    //             ingestInfo: { type: 'string' },
    //         },
    //         required: ['botId', 'url', 'type'],
    //     },
    // })
    // @Post('ingestWebPage')
    // @UseGuards(AccessTokenGuard)
    // async ingestWebPage(@Body() body: any, @Req() req: any) {
    //     const user = req.user as IUser;
    //     return this.contentService.ingestWebPage(body, user);
    // }
    // //#endregion

}