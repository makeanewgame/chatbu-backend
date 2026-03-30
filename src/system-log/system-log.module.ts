import { Module, Global } from '@nestjs/common';
import { SystemLogController } from './system-log.controller';
import { SystemLogService } from './system-log.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Global()
@Module({
    imports: [PrismaModule, JwtModule],
    controllers: [SystemLogController],
    providers: [SystemLogService],
    exports: [SystemLogService],
})
export class SystemLogModule { }
