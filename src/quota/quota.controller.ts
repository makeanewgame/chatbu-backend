import { Controller, Get, Req } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { Request } from 'express';

@Controller('quota')
export class QuotaController {
    constructor(
        private readonly quotaService: QuotaService
    ) { }

    @Get('list')
    async list(@Req() req: Request) {

        const { user } = req.query;
        return await this.quotaService.list(user as string);

    }
}
