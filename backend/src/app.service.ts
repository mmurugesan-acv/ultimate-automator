/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PROMPT_FOR_FRAMEWORKS } from './prompt';
import * as fs from 'fs';
import * as path from 'path';

const LLM_URL =
  'https://llm-gateway.internal.latest.acvauctions.com/openai/v1/chat/completions';

@Injectable()
export class AppService {
  private dbPath = path.join(process.cwd(), 'db.json');

  private readDatabase() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading database:', error);
      return { githubTokens: {}, users: {}, selectedRepositories: {} };
    }
  }

  async generateCode(target: string, language: string, content: string) {
    try {
      const systemPrompt = PROMPT_FOR_FRAMEWORKS[target][language];

      if (!systemPrompt) {
        throw new Error(`Unsupported target: ${target}`);
      }

      const payload = {
        model: 'google/gemini-2.5-pro',
        messages: [
          systemPrompt,
          {
            role: 'user',
            content: JSON.stringify(content),
          },
        ],
        stream: false,
      };

      const response = await fetch(LLM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        message: 'Code generation completed',
        data: {
          generatedAt: new Date().toISOString(),
          codeId: Math.random().toString(36).substring(7),
          generatedCode: result.choices?.[0]?.message?.content || '',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Code generation failed',
        error: error.message,
      };
    }
  }

  async runTests(
    userId: string,
    target: string,
    language: string,
    content: string,
  ) {
    try {
      const db = this.readDatabase();
      const selectedRepo = db.selectedRepositories?.[userId];
      const githubToken = db.githubTokens?.[userId];

      if (!selectedRepo) {
        return {
          success: false,
          error: 'No repository selected for this user',
        };
      }

      // Send request to Docker container
      const dockerResponse = await fetch('http://localhost:3001/run-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository: selectedRepo,
          githubToken: githubToken,
          testConfig: {
            target,
            language,
            code: content,
          },
        }),
      });

      const dockerResult = await dockerResponse.json();

      return {
        success: true,
        message: 'Test execution started',
        data: {
          streamUrl: 'http://localhost:3001/stream.mjpeg',
          ...dockerResult,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
