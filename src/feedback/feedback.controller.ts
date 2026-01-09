import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Request,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiParam,
} from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from 'src/admin/guards/admin.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';
import { GetAllFeedbacksDto } from './dto/get-all-feedbacks.dto';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
    constructor(private feedbackService: FeedbackService) { }

    @ApiOperation({ summary: 'Submit feedback (User)' })
    @ApiResponse({
        status: 201,
        description: 'Feedback submitted successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request',
    })
    @ApiBearerAuth()
    @UseGuards(AccessTokenGuard)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createFeedback(@Request() req, @Body() dto: CreateFeedbackDto) {
        return this.feedbackService.createFeedback(req.user.sub, dto);
    }

    @ApiOperation({ summary: 'Get all feedbacks (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Feedbacks retrieved successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request',
    })
    @ApiBearerAuth()
    @UseGuards(AccessTokenGuard, AdminGuard)
    @Get('admin')
    @HttpCode(HttpStatus.OK)
    async getAllFeedbacks(@Query() dto: GetAllFeedbacksDto) {
        return this.feedbackService.getAllFeedbacks(dto);
    }

    @ApiOperation({ summary: 'Get feedback by ID (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Feedback retrieved successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request',
    })
    @ApiParam({
        name: 'id',
        description: 'Feedback ID',
        type: String,
    })
    @ApiBearerAuth()
    @UseGuards(AccessTokenGuard, AdminGuard)
    @Get('admin/:id')
    @HttpCode(HttpStatus.OK)
    async getFeedbackById(@Param('id') id: string) {
        return this.feedbackService.getFeedbackById(id);
    }

    @ApiOperation({ summary: 'Update feedback status (Admin only)' })
    @ApiResponse({
        status: 200,
        description: 'Feedback status updated successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request',
    })
    @ApiParam({
        name: 'id',
        description: 'Feedback ID',
        type: String,
    })
    @ApiBearerAuth()
    @UseGuards(AccessTokenGuard, AdminGuard)
    @Patch('admin/:id/status')
    @HttpCode(HttpStatus.OK)
    async updateFeedbackStatus(
        @Param('id') id: string,
        @Body() dto: UpdateFeedbackStatusDto,
    ) {
        return this.feedbackService.updateFeedbackStatus(id, dto);
    }
}
