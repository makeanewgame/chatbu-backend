import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { ShopifyTokenGuard } from './shopify-token.guard';
import { ShopifyClientSecretGuard } from './shopify-client-secret.guard';
import { ShopifyService } from './shopify.service';

interface IUser {
    sub: string;
    teamId: string;
}

class AuthorizeDto {
    @IsString()
    @IsNotEmpty()
    state!: string;

    @IsString()
    @IsNotEmpty()
    redirectUri!: string;
}

class TokenDto {
    @IsString()
    @IsNotEmpty()
    code!: string;
}

class CompleteDto {
    @IsString()
    @IsNotEmpty()
    botId!: string;

    @IsString()
    @IsNotEmpty()
    shop!: string;
}

@ApiTags('Shopify Integration')
@Controller('integration/shopify')
export class ShopifyController {
    constructor(private readonly shopify: ShopifyService) { }

    /** Dashboard consent screen (chatbu-frontend) mints a one-time code on approval. */
    @Post('authorize')
    @HttpCode(200)
    @UseGuards(AccessTokenGuard)
    async authorize(@Req() req: Request, @Body() body: AuthorizeDto) {
        const user = req.user as IUser;
        return this.shopify.createAuthorizationCode(user.teamId, user.sub, body.redirectUri);
    }

    /** Shopify app backend, server-to-server, redeems the code for a scoped access token. */
    @Post('token')
    @HttpCode(200)
    @UseGuards(ShopifyClientSecretGuard)
    async token(@Body() body: TokenDto) {
        return this.shopify.exchangeCodeForToken(body.code);
    }

    /** Shopify app calls with its scoped token to populate the bot picker. */
    @Get('bots')
    @UseGuards(ShopifyTokenGuard)
    async bots(@Req() req: Request) {
        const user = req.user as IUser;
        return this.shopify.listBots(user.teamId);
    }

    /** Shopify app calls once the merchant picks a bot. */
    @Post('complete')
    @HttpCode(200)
    @UseGuards(ShopifyTokenGuard)
    async complete(@Req() req: Request, @Body() body: CompleteDto) {
        const user = req.user as IUser;
        return this.shopify.completeConnection(user.teamId, body.botId, body.shop);
    }

    /** Dashboard Integrations page status card. */
    @Get('status')
    @UseGuards(AccessTokenGuard)
    async status(@Req() req: Request) {
        const user = req.user as IUser;
        return this.shopify.getStatus(user.teamId);
    }

    /** Dashboard-initiated disconnect. */
    @Delete('disconnect')
    @HttpCode(200)
    @UseGuards(AccessTokenGuard)
    async disconnect(@Req() req: Request) {
        const user = req.user as IUser;
        return this.shopify.disconnect(user.teamId);
    }

    /** Shopify app's uninstall webhook calls this with its own scoped token (no dashboard JWT available). */
    @Delete('uninstall')
    @HttpCode(200)
    @UseGuards(ShopifyTokenGuard)
    async uninstall(@Req() req: Request) {
        const user = req.user as IUser;
        return this.shopify.disconnect(user.teamId);
    }
}
