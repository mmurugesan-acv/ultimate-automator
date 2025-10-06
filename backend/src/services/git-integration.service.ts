/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

interface Database {
  githubTokens: { [userId: string]: string };
  users: { [userId: string]: any };
  selectedRepositories: { [userId: string]: any };
}

@Injectable()
export class GitIntegrationService {
  private dbPath = path.join(process.cwd(), 'db.json');

  constructor(private configService: ConfigService) {
    this.initializeDatabase();
  }

  private initializeDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      const initialData: Database = {
        githubTokens: {},
        users: {},
        selectedRepositories: {},
      };
      fs.writeFileSync(this.dbPath, JSON.stringify(initialData, null, 2));
    }
  }

  private readDatabase(): Database {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading database:', error);
      return { githubTokens: {}, users: {}, selectedRepositories: {} };
    }
  }

  private writeDatabase(data: Database) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing database:', error);
      throw new Error('Failed to save data');
    }
  }

  async handleGitHubCallback(code: string) {
    try {
      const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GITHUB_CLIENT_SECRET',
      );

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

  storeGitHubToken(token: string, userId: string) {
    try {
      const db = this.readDatabase();
      db.githubTokens[userId] = token;
      this.writeDatabase(db);

      return {
        success: true,
        message: 'Token stored successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getStoredGitHubToken(userId: string): string | null {
    try {
      const db = this.readDatabase();
      return db.githubTokens[userId] || null;
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  async getGitHubRepositories(token: string) {
    try {
      const response = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=50',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (response.ok) {
        const repositories = await response.json();

        const formattedRepos = repositories.map((repo) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          html_url: repo.html_url,
          updated_at: repo.updated_at,
          language: repo.language,
        }));

        return {
          success: true,
          repositories: formattedRepos,
        };
      } else {
        return {
          success: false,
          error: 'Failed to fetch repositories',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  storeSelectedRepository(userId: string, repository: any) {
    try {
      const db = this.readDatabase();

      if (!db.selectedRepositories) {
        db.selectedRepositories = {};
      }

      db.selectedRepositories[userId] = {
        ...repository,
        selectedAt: new Date().toISOString(),
      };

      this.writeDatabase(db);

      return {
        success: true,
        message: 'Repository selected successfully',
        data: {
          repository: db.selectedRepositories[userId],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getSelectedRepository(userId: string) {
    try {
      const db = this.readDatabase();
      return db.selectedRepositories?.[userId] || null;
    } catch (error) {
      console.error('Error retrieving selected repository:', error);
      return null;
    }
  }
}
