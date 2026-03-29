import { Module } from '@nestjs/common';
import { MinioClientService } from './minio-client.service';
import { MinioModule } from 'nestjs-minio-client';
import { ConfigService } from '@nestjs/config';


@Module({
  providers: [
    MinioClientService,
  ],
  imports: [
    MinioModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        endPoint: configService.get('S3_ENDPOINT_HOST'),
        port: parseInt(configService.get('S3_PORT')),
        useSSL: configService.get('S3_USE_SSL') === 'true',
        accessKey: configService.get('S3_ACCESS_KEY'),
        secretKey: configService.get('S3_SECRET_KEY'),
      }),
    }),
  ],
  exports: [MinioClientService]
})
export class MinioClientModule {

}
