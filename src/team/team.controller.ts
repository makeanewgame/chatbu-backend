import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Req,
    UseGuards,
    Headers,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ResendInvitationDto } from './dto/resend-invitation.dto';
import { SaveBusinessProfileDto } from './dto/save-business-profile.dto';
import { UpdateLiveChatConfigDto } from './dto/live-chat-config.dto';
import {
    TeamMemberResponse,
    InvitationResponse,
    RemoveMemberResponse,
    BusinessProfileResponse,
    CompleteOnboardingResponse,
    LiveChatConfigResponse,
} from './dto/team-responses.dto';
import { IUser } from 'src/util/interfaces';

/**
 * Pick the mail template language. The web app sends its active i18next
 * locale in a custom `language` header (prepareHeaders in reauth.ts); the
 * browser's `Accept-Language` is only a fallback since it reflects the OS
 * locale, not the app's selected language. Only `tr` and `en` templates
 * exist, so everything else falls back to English.
 */
function resolveLang(appLang?: string, acceptLang?: string): 'tr' | 'en' {
    const hint = (appLang || acceptLang || '').toLowerCase();
    return hint.startsWith('tr') ? 'tr' : 'en';
}

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

    @Get('live-chat-config')
    async getLiveChatConfig(@Req() req): Promise<LiveChatConfigResponse> {
        const user = req.user as IUser;
        return this.teamService.getLiveChatConfig(user.sub, user.teamId);
    }

    @Put('live-chat-config')
    async updateLiveChatConfig(
        @Req() req,
        @Body() dto: UpdateLiveChatConfigDto,
    ): Promise<LiveChatConfigResponse> {
        const user = req.user as IUser;
        return this.teamService.updateLiveChatConfig(user.sub, user.teamId, dto);
    }

    @Post('invite')
    async inviteMember(
        @Req() req,
        @Body() inviteMemberDto: InviteMemberDto,
        @Headers('language') appLang?: string,
        @Headers('accept-language') acceptLang?: string,
    ): Promise<InvitationResponse> {
        const userId = req.user.sub;
        const teamId = req.user.teamId;
        return this.teamService.inviteMember(
            userId,
            teamId,
            inviteMemberDto.email,
            resolveLang(appLang, acceptLang),
        );
    }

    @Post('invite/resend')
    async resendInvitation(
        @Req() req,
        @Body() resendInvitationDto: ResendInvitationDto,
        @Headers('language') appLang?: string,
        @Headers('accept-language') acceptLang?: string,
    ): Promise<InvitationResponse> {
        const userId = req.user.sub;
        const teamId = req.user.teamId;
        return this.teamService.resendInvitation(
            userId,
            teamId,
            resendInvitationDto.memberId,
            resolveLang(appLang, acceptLang),
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

    @Get('profile')
    async getBusinessProfile(@Req() req): Promise<BusinessProfileResponse> {
        const user = req.user as IUser;
        return this.teamService.getBusinessProfile(user.teamId);
    }

    @Post('profile')
    async saveBusinessProfile(
        @Req() req,
        @Body() saveBusinessProfileDto: SaveBusinessProfileDto,
    ): Promise<BusinessProfileResponse> {
        const user = req.user as IUser;
        return this.teamService.saveBusinessProfile(user.teamId, saveBusinessProfileDto);
    }

    @Post('completeOnboarding')
    async completeOnboarding(@Req() req): Promise<CompleteOnboardingResponse> {
        const user = req.user as IUser;
        return this.teamService.completeOnboarding(user.teamId);
    }
}
