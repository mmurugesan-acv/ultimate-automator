/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Post, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import type { Request, Response } from 'express';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Post('generatecode')
  async generateCode(
    @Req()
    req: Request & {
      body: { target: string; language: string; content: string };
    },
    @Res() res: Response,
  ) {
    const result = await this.appService.generateCode(
      req.body.target,
      req.body.language,
      req.body.content,
    );

    return res.json(result);
  }

  @Get('auth/github')
  githubAuth(@Res() res: Response) {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/auth/github/callback`;
    const scope = 'repo,user:email';

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

    return res.redirect(githubAuthUrl);
  }

  @Get('auth/github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    const result = await this.appService.handleGitHubCallback(code);

    if (result.success) {
      // Redirect to success page or close popup
      return res.send(`
        <script>
          window.opener.postMessage({type: 'GITHUB_AUTH_SUCCESS', data: ${JSON.stringify(
            result.data,
          )}}, '*');
          window.close();
        </script>
      `);
    } else {
      return res.send(`
        <script>
          window.opener.postMessage({type: 'GITHUB_AUTH_ERROR', error: '${result.error}'}, '*');
          window.close();
        </script>
      `);
    }
  }

  @Post('auth/github/user')
  async getGitHubUser(@Req() req: Request & { body: { token: string } }) {
    return await this.appService.getGitHubUser(req.body.token);
  }

  @Post('auth/github/store-token')
  storeGitHubToken(
    @Req() req: Request & { body: { token: string; userId: string } },
  ) {
    return this.appService.storeGitHubToken(req.body.token, req.body.userId);
  }

  @Post('auth/github/repositories')
  async getGitHubRepositories(
    @Req() req: Request & { body: { token: string } },
  ) {
    console.log('Get repos');

    return await this.appService.getGitHubRepositories(req.body.token);
  }

  @Post('auth/github/get-token')
  getStoredGitHubToken(@Req() req: Request & { body: { userId: string } }) {
    const token = this.appService.getStoredGitHubToken(req.body.userId);
    return {
      success: !!token,
      token: token,
    };
  }
}
