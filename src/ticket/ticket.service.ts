import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Injectable()
export class TicketService {
    constructor(private prisma: PrismaService) { }

    // Create a new ticket
    async createTicket(body: CreateTicketDto, userId: string, teamId: string) {
        try {
            const ticketNumber = this.generateTicketNumber();

            const ticket = await this.prisma.ticket.create({
                data: {
                    ticketNumber,
                    userId,
                    teamId,
                    title: body.title,
                    description: body.description,
                    category: body.category,
                    status: 'OPEN',
                },
                include: {
                    messages: true,
                },
            });

            // Create notification for admins in the team
            await this.notifyAdmins(teamId, ticket.id, 'NEW_TICKET', `New support ticket: ${body.title}`);

            return {
                success: true,
                message: 'Ticket created successfully',
                data: ticket,
            };
        } catch (error) {
            console.error('Error creating ticket:', error);
            return {
                success: false,
                message: 'Error creating ticket',
                error: error.message,
            };
        }
    }

    // Get all tickets for a user
    async getUserTickets(userId: string) {
        try {
            const tickets = await this.prisma.ticket.findMany({
                where: { userId },
                include: {
                    messages: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return {
                success: true,
                data: tickets,
            };
        } catch (error) {
            console.error('Error fetching user tickets:', error);
            return {
                success: false,
                message: 'Error fetching tickets',
                error: error.message,
            };
        }
    }

    // Get all tickets for a team (admin view)
    async getTeamTickets(teamId: string) {
        try {
            const tickets = await this.prisma.ticket.findMany({
                where: { teamId },
                include: {
                    messages: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return {
                success: true,
                data: tickets,
            };
        } catch (error) {
            console.error('Error fetching team tickets:', error);
            return {
                success: false,
                message: 'Error fetching tickets',
                error: error.message,
            };
        }
    }

    // Get a single ticket by ID
    async getTicketById(ticketId: string) {
        try {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    messages: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            if (!ticket) {
                return {
                    success: false,
                    message: 'Ticket not found',
                };
            }

            return {
                success: true,
                data: ticket,
            };
        } catch (error) {
            console.error('Error fetching ticket:', error);
            return {
                success: false,
                message: 'Error fetching ticket',
                error: error.message,
            };
        }
    }

    // Add message to ticket
    async addTicketMessage(ticketId: string, body: AddTicketMessageDto, userId: string) {
        try {
            // Check if ticket exists
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
            });

            if (!ticket) {
                return {
                    success: false,
                    message: 'Ticket not found',
                };
            }

            // Check if user is admin (for this validation, check if isAdminReply is being used)
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
            });

            const message = await this.prisma.ticketMessage.create({
                data: {
                    ticketId,
                    userId,
                    message: body.message,
                    isAdminReply: body.isAdminReply || false,
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

            // Notify the other party
            const notificationTitle = body.isAdminReply
                ? 'New reply from support team'
                : 'New message from customer';

            await this.notifyMessageReply(
                ticketId,
                userId,
                ticket.userId,
                body.isAdminReply,
                notificationTitle
            );

            return {
                success: true,
                message: 'Message added successfully',
                data: message,
            };
        } catch (error) {
            console.error('Error adding message:', error);
            return {
                success: false,
                message: 'Error adding message',
                error: error.message,
            };
        }
    }

    // Update ticket status
    async updateTicketStatus(ticketId: string, body: UpdateTicketStatusDto) {
        try {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
            });

            if (!ticket) {
                return {
                    success: false,
                    message: 'Ticket not found',
                };
            }

            const updateData: any = { status: body.status };

            if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
                updateData.resolvedAt = new Date();
            }

            const updatedTicket = await this.prisma.ticket.update({
                where: { id: ticketId },
                data: updateData,
                include: {
                    messages: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            // Notify user about status change
            const statusMessages = {
                OPEN: 'Your ticket status changed to Open',
                IN_PROGRESS: 'Your ticket is being reviewed',
                RESOLVED: 'Your ticket has been resolved',
                CLOSED: 'Your ticket has been closed',
            };

            await this.prisma.notification.create({
                data: {
                    ticketId,
                    userId: ticket.userId,
                    type: 'TICKET_REPLY',
                    title: 'Ticket Status Updated',
                    message: statusMessages[body.status],
                },
            });

            return {
                success: true,
                message: 'Ticket status updated',
                data: updatedTicket,
            };
        } catch (error) {
            console.error('Error updating ticket status:', error);
            return {
                success: false,
                message: 'Error updating ticket',
                error: error.message,
            };
        }
    }

    // Get unread notifications for user
    async getUserNotifications(userId: string) {
        try {
            const notifications = await this.prisma.notification.findMany({
                where: { userId, isRead: false },
                include: {
                    ticket: {
                        select: {
                            id: true,
                            ticketNumber: true,
                            title: true,
                            status: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            return {
                success: true,
                data: notifications,
            };
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return {
                success: false,
                message: 'Error fetching notifications',
                error: error.message,
            };
        }
    }

    // Mark notification as read
    async markNotificationAsRead(notificationId: string) {
        try {
            const notification = await this.prisma.notification.update({
                where: { id: notificationId },
                data: { isRead: true },
            });

            return {
                success: true,
                data: notification,
            };
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return {
                success: false,
                message: 'Error marking notification as read',
                error: error.message,
            };
        }
    }

    // Helper: Generate unique ticket number
    private generateTicketNumber(): string {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `TKT-${random}-${timestamp}`;
    }

    // Helper: Notify admins about new ticket
    private async notifyAdmins(
        teamId: string,
        ticketId: string,
        type: string,
        message: string
    ) {
        try {
            const teamMembers = await this.prisma.teamMember.findMany({
                where: {
                    teamId,
                    role: 'ADMIN',
                },
            });

            for (const member of teamMembers) {
                if (member.userId) {
                    await this.prisma.notification.create({
                        data: {
                            ticketId,
                            userId: member.userId,
                            type,
                            title: 'New Support Ticket',
                            message,
                        },
                    });
                }
            }
        } catch (error) {
            console.error('Error notifying admins:', error);
        }
    }

    // Helper: Notify on message reply
    private async notifyMessageReply(
        ticketId: string,
        senderId: string,
        targetUserId: string,
        isAdminReply: boolean,
        title: string
    ) {
        try {
            // Don't notify the sender
            if (senderId !== targetUserId) {
                await this.prisma.notification.create({
                    data: {
                        ticketId,
                        userId: targetUserId,
                        type: 'TICKET_REPLY',
                        title,
                        message: isAdminReply
                            ? 'Support team has replied to your ticket'
                            : 'You have a new message on your support ticket',
                    },
                });
            }
        } catch (error) {
            console.error('Error notifying message reply:', error);
        }
    }
}
