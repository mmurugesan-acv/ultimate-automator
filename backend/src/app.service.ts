/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROMPT_FOR_FRAMEWORKS } from './prompt';

const LLM_URL =
  'https://llm-gateway.internal.latest.acvauctions.com/openai/v1/chat/completions';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

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

  async handleGitHubCallback(code: string) {
    try {
      const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GITHUB_CLIENT_SECRET',
      );

      // Exchange code for access token
      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
          }),
        },
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        const userData = await userResponse.json();

        return {
          success: true,
          data: {
            token: tokenData.access_token,
            user: {
              id: userData.id,
              login: userData.login,
              name: userData.name,
              avatar_url: userData.avatar_url,
            },
          },
        };
      } else {
        return {
          success: false,
          error: 'Failed to get access token',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getGitHubUser(token: string) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'Invalid token' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
