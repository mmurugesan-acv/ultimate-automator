/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Post, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitIntegrationService } from '../services/git-integration.service';
import type { Request, Response } from 'express';

@Controller('api/auth/github')
export class GitIntegrationController {
  constructor(
    private readonly gitIntegrationService: GitIntegrationService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  githubAuth(@Res() res: Response) {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/auth/github/callback`;
    const scope = 'repo,user:email';

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

    return res.redirect(githubAuthUrl);
  }

  @Get('callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    const result = await this.gitIntegrationService.handleGitHubCallback(code);

    if (result.success) {
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

  @Post('user')
  async getGitHubUser(@Req() req: Request & { body: { token: string } }) {
    return await this.gitIntegrationService.getGitHubUser(req.body.token);
  }

  @Post('store-token')
  storeGitHubToken(
    @Req() req: Request & { body: { token: string; userId: string } },
  ) {
    return this.gitIntegrationService.storeGitHubToken(
      req.body.token,
      req.body.userId,
    );
  }

  @Post('repositories')
  async getGitHubRepositories(
    @Req() req: Request & { body: { token: string } },
  ) {
    console.log('Get repos');
    return await this.gitIntegrationService.getGitHubRepositories(
      req.body.token,
    );
  }

  @Post('get-token')
  getStoredGitHubToken(@Req() req: Request & { body: { userId: string } }) {
    const token = this.gitIntegrationService.getStoredGitHubToken(
      req.body.userId,
    );
    return {
      success: !!token,
      token: token,
    };
  }

  @Post('select-repository')
  async selectRepository(
    @Req()
    req: Request & {
      body: {
        userId: string;
        repository: {
          id: number;
          name: string;
          full_name: string;
          clone_url: string;
          ssh_url: string;
          private: boolean;
        };
      };
    },
  ) {
    return await this.gitIntegrationService.storeSelectedRepository(
      req.body.userId,
      req.body.repository,
    );
  }
}
