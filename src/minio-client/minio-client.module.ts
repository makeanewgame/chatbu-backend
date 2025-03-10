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
        endPoint: configService.get('MINIO_ENDPOINT'),
        port: parseInt(configService.get('MINIO_PORT')),
        useSSL: configService.get('MINIO_USE_SSL') === 'true',
        accessKey: configService.get('MINIO_ACCESS_KEY'),
        secretKey: configService.get('MINIO_SECRET_KEY'),
      }),
    }),
  ],
  exports: [MinioClientService]
})
export class MinioClientModule {

}
