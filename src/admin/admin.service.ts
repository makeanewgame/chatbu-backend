import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService
    ) { }

    async getAllUsers() {
        // Implementation for getting all users
    }
}
