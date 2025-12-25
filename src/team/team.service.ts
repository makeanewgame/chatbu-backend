import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { randomUUID } from 'crypto';
import {
    TeamMemberResponse,
    InvitationResponse,
    RemoveMemberResponse,
} from './dto/team-responses.dto';

@Injectable()
export class TeamService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) { }

    async getMembers(userId: string, teamId: string): Promise<TeamMemberResponse[]> {

        console.log('Fetching members for teamId:', teamId, 'requested by userId:', userId);

        // Get the user's team membership to verify access
        const userMembership = await this.prisma.teamMember.findFirst({
            where: {
                userId,
                teamId,
            },
        });

        console.log('User Membership:', userMembership);

        if (!userMembership) {
            throw new ForbiddenException('You are not a member of this team');
        }

        // Get all team members including pending invitations
        const members = await this.prisma.teamMember.findMany({
            where: {
                teamId,
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
            orderBy: {
                createdAt: 'asc',
            },
        });

        // Format the response
        return members.map((member) => {
            const response: TeamMemberResponse = {
                id: member.id,
                userId: member.userId,
                teamId: member.teamId,
                role: member.role,
                status: member.status,
                createdAt: member.createdAt,
                updatedAt: member.updatedAt,
            };

            // For active members, include user data
            if (member.status === 'active' && member.user) {
                response.user = {
                    id: member.user.id,
                    name: member.user.name,
                    email: member.user.email,
                };
            }

            // For pending members, include email
            if (member.status === 'pending' && member.email) {
                response.email = member.email;
            }

            return response;
        });
    }

    async inviteMember(
        userId: string,
        teamId: string,
        email: string,
        lang: string,
    ): Promise<InvitationResponse> {
        // Verify the requester is the team owner
        const requesterMembership = await this.prisma.teamMember.findFirst({
            where: {
                userId,
                teamId,
                role: 'TEAM_OWNER',
            },
            include: {
                team: true,
                user: true,
            },
        });

        if (!requesterMembership) {
            throw new ForbiddenException('Only team owners can invite members');
        }

        // Check if email is already a team member (active or pending)
        const existingMember = await this.prisma.teamMember.findFirst({
            where: {
                teamId,
                OR: [
                    { email },
                    {
                        user: {
                            email,
                        },
                    },
                ],
            },
        });

        if (existingMember) {
            throw new BadRequestException('User is already a member of this team');
        }

        // Check if email is already registered
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new BadRequestException(
                'This email is already registered. Please ask them to join your team directly.',
            );
        }

        // Generate invitation token
        const invitationToken = randomUUID();

        // Create TeamMember record with pending status
        const newMember = await this.prisma.teamMember.create({
            data: {
                teamId,
                email,
                role: 'TEAM_MEMBER',
                status: 'pending',
                invitationToken,
            },
        });

        // Send invitation email
        const invitationUrl = `${process.env.FRONTEND_URL}/register?token=${invitationToken}&email=${encodeURIComponent(email)}&teamId=${teamId}`;

        await this.mailService.sendTeamInvitationMail(
            email,
            requesterMembership.team.name || `${requesterMembership.user.name}'s Team`,
            requesterMembership.user.name,
            invitationUrl,
            lang,
        );

        this.logger.info(`Team invitation sent to ${email} for team ${teamId}`);

        return {
            success: true,
            message: 'Invitation sent successfully',
            data: {
                memberId: newMember.id,
                email: newMember.email,
                status: newMember.status,
            },
        };
    }

    async resendInvitation(
        userId: string,
        teamId: string,
        memberId: string,
        lang: string,
    ): Promise<InvitationResponse> {
        // Verify the requester is the team owner
        const requesterMembership = await this.prisma.teamMember.findFirst({
            where: {
                userId,
                teamId,
                role: 'TEAM_OWNER',
            },
            include: {
                team: true,
                user: true,
            },
        });

        if (!requesterMembership) {
            throw new ForbiddenException('Only team owners can resend invitations');
        }

        // Get the team member
        const member = await this.prisma.teamMember.findUnique({
            where: { id: memberId },
        });

        if (!member || member.teamId !== teamId) {
            throw new NotFoundException('Team member not found');
        }

        if (member.status !== 'pending') {
            throw new BadRequestException('This member is already active');
        }

        // Resend invitation email
        const invitationUrl = `${process.env.FRONTEND_URL}/register?token=${member.invitationToken}&email=${encodeURIComponent(member.email)}&teamId=${teamId}`;

        await this.mailService.sendTeamInvitationMail(
            member.email,
            requesterMembership.team.name || `${requesterMembership.user.name}'s Team`,
            requesterMembership.user.name,
            invitationUrl,
            lang,
        );

        this.logger.info(`Team invitation resent to ${member.email} for team ${teamId}`);

        return {
            success: true,
            message: 'Invitation resent successfully',
        };
    }

    async removeMember(
        userId: string,
        teamId: string,
        targetUserId: string,
    ): Promise<RemoveMemberResponse> {
        // Verify the requester is the team owner
        const requesterMembership = await this.prisma.teamMember.findFirst({
            where: {
                userId,
                teamId,
                role: 'TEAM_OWNER',
            },
        });

        if (!requesterMembership) {
            throw new ForbiddenException('Only team owners can remove members');
        }

        // Prevent owner from removing themselves
        if (userId === targetUserId) {
            throw new BadRequestException('You cannot remove yourself from the team');
        }

        // Find the target member
        const targetMember = await this.prisma.teamMember.findFirst({
            where: {
                userId: targetUserId,
                teamId,
            },
        });

        if (!targetMember) {
            throw new NotFoundException('Team member not found');
        }

        // Delete the team member
        await this.prisma.teamMember.delete({
            where: { id: targetMember.id },
        });

        this.logger.info(
            `User ${targetUserId} removed from team ${teamId} by ${userId}`,
        );

        return {
            success: true,
            message: 'Member removed successfully',
        };
    }
}
