import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
    Headers,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ResendInvitationDto } from './dto/resend-invitation.dto';
import {
    TeamMemberResponse,
    InvitationResponse,
    RemoveMemberResponse,
} from './dto/team-responses.dto';
import { IUser } from 'src/util/interfaces';

@Controller('team')
@UseGuards(AccessTokenGuard)
export class TeamController {
    constructor(private readonly teamService: TeamService) { }

    @Get('members')
    async getMembers(@Req() req): Promise<TeamMemberResponse[]> {

        const user = req.user as IUser;

        const userId = user.sub;
        const teamId = user.teamId;
        return this.teamService.getMembers(userId, teamId);
    }

    @Post('invite')
    async inviteMember(
        @Req() req,
        @Body() inviteMemberDto: InviteMemberDto,
        @Headers('accept-language') lang?: string,
    ): Promise<InvitationResponse> {
        const userId = req.user.sub;
        const teamId = req.user.teamId;
        const language = lang?.startsWith('tr') ? 'tr' : 'en';
        return this.teamService.inviteMember(
            userId,
            teamId,
            inviteMemberDto.email,
            language,
        );
    }

    @Post('invite/resend')
    async resendInvitation(
        @Req() req,
        @Body() resendInvitationDto: ResendInvitationDto,
        @Headers('accept-language') lang?: string,
    ): Promise<InvitationResponse> {
        const userId = req.user.sub;
        const teamId = req.user.teamId;
        const language = lang?.startsWith('tr') ? 'tr' : 'en';
        return this.teamService.resendInvitation(
            userId,
            teamId,
            resendInvitationDto.memberId,
            language,
        );
    }

    @Delete('members/:userId')
    async removeMember(
        @Req() req,
        @Param('userId') targetUserId: string,
    ): Promise<RemoveMemberResponse> {
        const userId = req.user.sub;
        const teamId = req.user.teamId;
        return this.teamService.removeMember(userId, teamId, targetUserId);
    }
}
