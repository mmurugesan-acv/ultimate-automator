/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Post, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Request, Response } from 'express';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}
