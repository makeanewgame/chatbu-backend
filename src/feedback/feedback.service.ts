import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';
import { GetAllFeedbacksDto } from './dto/get-all-feedbacks.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class FeedbackService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) { }

    async createFeedback(userId: string, dto: CreateFeedbackDto) {
        try {
            // Get user information
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Create feedback
            const feedback = await this.prisma.feedback.create({
                data: {
                    userId: user.id,
                    userName: user.name,
                    userEmail: user.email,
                    category: dto.category,
                    message: dto.message,
                    status: 'PENDING',
                },
            });

            // Get all admin users for email notification
            const adminUsers = await this.prisma.user.findMany({
                where: {
                    role: 'ADMIN',
                    isDeleted: false,
                    emailVerified: true,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            });

            // Send email notifications to all admins
            const emailPromises = adminUsers.map((admin) =>
                this.mailService
                    .sendNewFeedbackNotification(
                        admin.email,
                        admin.name,
                        {
                            userName: user.name,
                            userEmail: user.email,
                            category: dto.category,
                            message: dto.message,
                            feedbackId: feedback.id,
                        },
                        'en', // You can make this dynamic based on admin preference
                    )
                    .catch((error) => {
                        this.logger.error(
                            `Failed to send feedback notification to ${admin.email}:`,
                            error,
                        );
                        // Don't throw error, just log it so other emails can still be sent
                    }),
            );

            // Send all emails in parallel
            await Promise.all(emailPromises);

            this.logger.info(
                `Feedback created by user ${user.email}, notifications sent to ${adminUsers.length} admins`,
            );

            return {
                success: true,
                message: 'Feedback submitted successfully',
                data: feedback,
            };
        } catch (error) {
            this.logger.error('Error creating feedback:', error);
            throw error;
        }
    }

    async getAllFeedbacks(dto: GetAllFeedbacksDto) {
        const { page = 1, limit = 10, status, category, search } = dto;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (category) {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { userName: { contains: search, mode: 'insensitive' } },
                { userEmail: { contains: search, mode: 'insensitive' } },
                { message: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [feedbacks, total] = await Promise.all([
            this.prisma.feedback.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            this.prisma.feedback.count({ where }),
        ]);

        return {
            data: feedbacks,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateFeedbackStatus(feedbackId: string, dto: UpdateFeedbackStatusDto) {
        // Check if feedback exists
        const feedback = await this.prisma.feedback.findUnique({
            where: { id: feedbackId },
        });

        if (!feedback) {
            throw new NotFoundException('Feedback not found');
        }

        // Update feedback status
        const updatedFeedback = await this.prisma.feedback.update({
            where: { id: feedbackId },
            data: {
                status: dto.status,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        this.logger.info(
            `Feedback ${feedbackId} status updated to ${dto.status}`,
        );

        return {
            success: true,
            message: 'Feedback status updated successfully',
            data: updatedFeedback,
        };
    }

    async getFeedbackById(feedbackId: string) {
        const feedback = await this.prisma.feedback.findUnique({
            where: { id: feedbackId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (!feedback) {
            throw new NotFoundException('Feedback not found');
        }

        return feedback;
    }
}
