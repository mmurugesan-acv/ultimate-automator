/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Post, Get, Req, Res } from '@nestjs/common';
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

  @Post('run-tests')
  async runTests(
    @Req()
    req: Request & {
      body: {
        userId: string;
        target: string;
        language: string;
        content: string;
      };
    },
    @Res() res: Response,
  ) {
    const result = await this.appService.runTests(
      req.body.userId,
      req.body.target,
      req.body.language,
      req.body.content,
    );

    return res.json(result);
  }

  @Get('logs')
  async streamLogs(@Req() req: Request, @Res() res: Response) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    try {
      // Proxy the SSE connection from the 3001 server
      const response = await fetch('http://localhost:3001/logs', {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.body) {
        throw new Error('No response body from logs endpoint');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Stream the data from 3001 to the client
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
        } catch (error) {
          console.error('Error streaming logs:', error);
          res.write(
            `data: ${JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              message: `Log stream error: ${error.message}`,
            })}\n\n`,
          );
        }
      };

      pump();

      // Handle client disconnect
      req.on('close', () => {
        reader.cancel();
        res.end();
      });
    } catch (error) {
      console.error('Failed to connect to log stream:', error);
      res.write(
        `data: ${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Failed to connect to log stream: ${error.message}`,
        })}\n\n`,
      );
      res.end();
    }
  }
}
