import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [MinioClientModule, PrismaModule, JwtModule],
  controllers: [FileController],
  providers: [FileService]
})
export class FileModule { }
