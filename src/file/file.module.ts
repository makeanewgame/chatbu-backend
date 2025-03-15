import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, MinioClientModule, PrismaModule, JwtModule],
  controllers: [FileController],
  providers: [FileService]
})
export class FileModule { }
