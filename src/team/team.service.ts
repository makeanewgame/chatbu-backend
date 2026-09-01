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
    BusinessProfileResponse,
    CompleteOnboardingResponse,
    LiveChatConfigResponse,
} from './dto/team-responses.dto';
import { SaveBusinessProfileDto } from './dto/save-business-profile.dto';
import { UpdateLiveChatConfigDto } from './dto/live-chat-config.dto';
import { MixpanelService } from 'src/analytics/mixpanel.service';

@Injectable()
export class TeamService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private mixpanel: MixpanelService,
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
                canLiveChat: member.canLiveChat,
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

        // `targetUserId` is the user's id for active members, but pending
        // invitations have no user yet, so the frontend sends the TeamMember
        // row id instead. Match on either.
        const targetMember = await this.prisma.teamMember.findFirst({
            where: {
                teamId,
                OR: [{ userId: targetUserId }, { id: targetUserId }],
            },
        });

        if (!targetMember) {
            throw new NotFoundException('Team member not found');
        }

        // Guard again in case we matched the owner's own row by id.
        if (targetMember.userId && targetMember.userId === userId) {
            throw new BadRequestException('You cannot remove yourself from the team');
        }

        // Delete the team member (or cancel the pending invitation)
        await this.prisma.teamMember.delete({
            where: { id: targetMember.id },
        });

        const what = targetMember.status === 'pending' ? 'invitation' : 'member';
        this.logger.info(
            `Team ${what} ${targetMember.id} removed from team ${teamId} by ${userId}`,
        );

        return {
            success: true,
            message:
                targetMember.status === 'pending'
                    ? 'Invitation cancelled successfully'
                    : 'Member removed successfully',
        };
    }

    /**
     * The live-chat handoff roster for the team: every active member with a
     * `canLiveChat` flag, plus the fallback (`defaultAgentId`) used when
     * nobody is flagged and pre-selected in the manual handover modal.
     */
    async getLiveChatConfig(
        userId: string,
        teamId: string,
    ): Promise<LiveChatConfigResponse> {
        const membership = await this.prisma.teamMember.findFirst({
            where: { userId, teamId },
            select: { id: true },
        });
        if (!membership) {
            throw new ForbiddenException('You are not a member of this team');
        }

        const [team, members] = await Promise.all([
            this.prisma.team.findUnique({
                where: { id: teamId },
                select: { defaultLiveChatAgentId: true },
            }),
            this.prisma.teamMember.findMany({
                where: { teamId, status: 'active', userId: { not: null } },
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        return {
            defaultAgentId: team?.defaultLiveChatAgentId ?? null,
            agents: members
                .filter((m) => m.user)
                .map((m) => ({
                    userId: m.userId as string,
                    name: m.user!.name,
                    email: m.user!.email,
                    role: m.role,
                    canLiveChat: m.canLiveChat,
                })),
        };
    }

    /**
     * Team-owner-only. Sets each member's `canLiveChat` flag and the team's
     * fallback agent. A member picked as fallback is auto-enabled for live
     * chat. If the fallback agent ends up outside the rotation pool the
     * round-robin cursor is reset so distribution restarts cleanly.
     */
    async updateLiveChatConfig(
        userId: string,
        teamId: string,
        dto: UpdateLiveChatConfigDto,
    ): Promise<LiveChatConfigResponse> {
        const requesterMembership = await this.prisma.teamMember.findFirst({
            where: { userId, teamId, role: 'TEAM_OWNER' },
        });
        if (!requesterMembership) {
            throw new ForbiddenException(
                'Only team owners can change the live-chat roster',
            );
        }

        const activeMembers = await this.prisma.teamMember.findMany({
            where: { teamId, status: 'active', userId: { not: null } },
            select: { id: true, userId: true },
        });
        const activeUserIds = new Set(
            activeMembers.map((m) => m.userId as string),
        );

        const flags = new Map<string, boolean>();
        for (const a of dto.agents ?? []) {
            if (!activeUserIds.has(a.userId)) {
                throw new BadRequestException(
                    `User ${a.userId} is not an active member of this team`,
                );
            }
            flags.set(a.userId, a.canLiveChat);
        }

        const defaultChanged = dto.defaultAgentId !== undefined;
        const defaultAgentId =
            dto.defaultAgentId === undefined || dto.defaultAgentId === ''
                ? null
                : dto.defaultAgentId;
        if (defaultChanged && defaultAgentId) {
            if (!activeUserIds.has(defaultAgentId)) {
                throw new BadRequestException(
                    'The default agent must be an active member of this team',
                );
            }
            // A fallback agent must be able to take live chats.
            flags.set(defaultAgentId, true);
        }

        await this.prisma.$transaction([
            ...activeMembers
                .filter((m) => flags.has(m.userId as string))
                .map((m) =>
                    this.prisma.teamMember.update({
                        where: { id: m.id },
                        data: { canLiveChat: flags.get(m.userId as string) },
                    }),
                ),
            this.prisma.team.update({
                where: { id: teamId },
                data: {
                    ...(defaultChanged && { defaultLiveChatAgentId: defaultAgentId }),
                    // Restart rotation from the top on any roster change so a
                    // stale cursor can't skip the newly-added agents.
                    lastLiveChatAgentId: null,
                },
            }),
        ]);

        this.logger.info(`Live-chat roster updated for team ${teamId}`);
        return this.getLiveChatConfig(userId, teamId);
    }

    async getBusinessProfile(teamId: string): Promise<BusinessProfileResponse> {
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            select: {
                businessName: true,
                companySize: true,
                industry: true,
                website: true,
                onboardingCompletedAt: true,
            },
        });

        if (!team) {
            throw new NotFoundException('Team not found');
        }

        return team;
    }

    async saveBusinessProfile(
        teamId: string,
        dto: SaveBusinessProfileDto,
    ): Promise<BusinessProfileResponse> {
        const team = await this.prisma.team.update({
            where: { id: teamId },
            data: {
                ...(dto.businessName !== undefined && { businessName: dto.businessName }),
                ...(dto.companySize !== undefined && { companySize: dto.companySize }),
                ...(dto.industry !== undefined && { industry: dto.industry }),
                ...(dto.website !== undefined && { website: dto.website }),
            },
            select: {
                businessName: true,
                companySize: true,
                industry: true,
                website: true,
                onboardingCompletedAt: true,
            },
        });

        this.logger.info(`Business profile saved for team ${teamId}`);

        // Team group properties + owner profile enrichment for B2B analytics.
        this.mixpanel.setGroup('team', teamId, {
            team_id: teamId,
            business_name: team.businessName,
            company_size: team.companySize,
            industry: team.industry,
            website: team.website,
        });
        this.mixpanel.resolveTeamOwner(teamId).then(({ ownerId }) => {
            if (ownerId) {
                this.mixpanel.setPeople(ownerId, {
                    company_size: team.companySize,
                    industry: team.industry,
                });
            }
        });

        return team;
    }

    async completeOnboarding(teamId: string): Promise<CompleteOnboardingResponse> {
        const team = await this.prisma.team.update({
            where: { id: teamId },
            data: { onboardingCompletedAt: new Date() },
            select: { onboardingCompletedAt: true },
        });

        this.logger.info(`Onboarding completed for team ${teamId}`);

        this.mixpanel.resolveTeamOwner(teamId).then(({ ownerId }) => {
            if (ownerId) {
                this.mixpanel.track(
                    'Onboarding Completed',
                    ownerId,
                    { organization_id: teamId, team_id: teamId },
                    `onboarding_completed:${teamId}`,
                );
                this.mixpanel.setPeople(ownerId, { onboarding_completed: true });
            }
        });

        return {
            success: true,
            onboardingCompletedAt: team.onboardingCompletedAt as Date,
        };
    }
}
