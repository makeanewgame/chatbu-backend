import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from './guards/admin.guard';
import { PricePlanService } from 'src/subscription/price-plan.service';
import { CreatePricePlanDto, PublishPricePlanDto } from 'src/subscription/dto/price-plan.dto';

@Controller('admin/price-plans')
@UseGuards(AccessTokenGuard, AdminGuard)
export class PricePlanController {
    constructor(private pricePlanService: PricePlanService) { }

    @Get()
    listPricePlans() {
        return this.pricePlanService.listPricePlans();
    }

    @Get('active')
    getActivePlans() {
        return this.pricePlanService.getActivePlans();
    }

    @Get('stats')
    getPlanStats() {
        return this.pricePlanService.getPlanStats();
    }

    @Post()
    createDraftPricePlan(@Body() dto: CreatePricePlanDto, @Req() req: any) {
        const adminId = req.user?.sub || req.user?.id;
        return this.pricePlanService.createDraftPricePlan(dto, adminId);
    }

    /**
     * Üç draft planı birlikte yayına alır.
     * Body: { monthlyDraftId, yearlyDraftId, tokenDraftId, confirmationText }
     */
    @Post('publish')
    publishPricePlans(
        @Body() body: { monthlyDraftId: string; yearlyDraftId: string; tokenDraftId: string } & PublishPricePlanDto,
    ) {
        return this.pricePlanService.publishPricePlans(
            body.monthlyDraftId,
            body.yearlyDraftId,
            body.tokenDraftId,
            { confirmationText: body.confirmationText },
        );
    }

    @Post('sync-stripe')
    syncStripeToActive() {
        return this.pricePlanService.syncStripeToActive();
    }

    @Delete(':id')
    deleteDraftPricePlan(@Param('id') id: string) {
        return this.pricePlanService.deleteDraftPricePlan(id);
    }
}
