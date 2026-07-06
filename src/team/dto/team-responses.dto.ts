export interface TeamMemberResponse {
    id: string;
    userId: string | null;
    teamId: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    user?: {
        id: string;
        name: string;
        email: string;
    };
    email?: string;
}

export interface InvitationResponse {
    success: boolean;
    message: string;
    data?: {
        memberId: string;
        email: string;
        status: string;
    };
}

export interface RemoveMemberResponse {
    success: boolean;
    message: string;
}

export interface BusinessProfileResponse {
    businessName: string | null;
    companySize: string | null;
    industry: string | null;
    website: string | null;
    onboardingCompletedAt: Date | null;
}

export interface CompleteOnboardingResponse {
    success: boolean;
    onboardingCompletedAt: Date;
}
