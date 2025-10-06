/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PROMPT_FOR_FRAMWORKS } from './prompt';

const LLM_URL =
  'https://llm-gateway.internal.latest.acvauctions.com/openai/v1/chat/completions';

@Injectable()
export class AppService {
  async generateCode(target: string, language: string, content: string) {
    try {
      const systemPrompt = PROMPT_FOR_FRAMWORKS[target][language];

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
}
