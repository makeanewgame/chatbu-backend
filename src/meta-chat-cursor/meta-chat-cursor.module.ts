import { Module } from '@nestjs/common';
import { MetaChatCursorService } from './meta-chat-cursor.service';

@Module({
    providers: [MetaChatCursorService],
    exports: [MetaChatCursorService],
})
export class MetaChatCursorModule { }
