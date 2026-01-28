import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';

@Controller('tickets')
@UseGuards(AccessTokenGuard)
export class TicketController {
    constructor(private ticketService: TicketService) { }

    // Create a new ticket
    @Post('create')
    async createTicket(@Body() createTicketDto: CreateTicketDto, @Request() req) {
        const user = req.user;
        return await this.ticketService.createTicket(
            createTicketDto,
            user.sub,
            user.teamId
        );
    }

    // Get user's own tickets
    @Get('my-tickets')
    async getUserTickets(@Request() req) {
        return await this.ticketService.getUserTickets(req.user.sub);
    }

    // Get ticket by ID
    @Get(':id')
    async getTicketById(@Param('id') ticketId: string) {
        return await this.ticketService.getTicketById(ticketId);
    }

    // Add message to ticket
    @Post(':id/messages')
    async addTicketMessage(
        @Param('id') ticketId: string,
        @Body() addMessageDto: AddTicketMessageDto,
        @Request() req
    ) {
        return await this.ticketService.addTicketMessage(
            ticketId,
            addMessageDto,
            req.user.sub
        );
    }

    // Get user notifications
    @Get('user/notifications')
    async getUserNotifications(@Request() req) {
        return await this.ticketService.getUserNotifications(req.user.sub);
    }

    // Mark notification as read
    @Patch('notifications/:id/read')
    async markNotificationAsRead(@Param('id') notificationId: string) {
        return await this.ticketService.markNotificationAsRead(notificationId);
    }

    // Admin: Get all team tickets
    @Get('admin/team-tickets')
    async getTeamTickets(@Request() req) {
        return await this.ticketService.getTeamTickets(req.user.teamId);
    }

    // Admin: Update ticket status
    @Patch('admin/:id/status')
    async updateTicketStatus(
        @Param('id') ticketId: string,
        @Body() updateStatusDto: UpdateTicketStatusDto
    ) {
        return await this.ticketService.updateTicketStatus(ticketId, updateStatusDto);
    }
}
