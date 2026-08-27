import { Module, Global } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MixpanelService } from './mixpanel.service';

/**
 * Server-side product/revenue analytics. Global so any service can inject
 * MixpanelService without wiring imports, exactly like SystemLogModule.
 */
@Global()
@Module({
    imports: [PrismaModule],
    providers: [MixpanelService],
    exports: [MixpanelService],
})
export class AnalyticsModule { }
