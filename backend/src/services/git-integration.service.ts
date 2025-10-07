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

  async createPullRequest(
    userId: string,
    code: string,
    title: string = 'Add Ultimate Automator test code',
    description: string = 'Automated test code generated by Ultimate Automator',
  ) {
    try {
      const db = this.readDatabase();
      const token = db.githubTokens?.[userId];
      const selectedRepo = db.selectedRepositories?.[userId];

      if (!token) {
        return {
          success: false,
          error: 'No GitHub token found for user',
        };
      }

      if (!selectedRepo) {
        return {
          success: false,
          error: 'No repository selected for user',
        };
      }

      // Create a new branch name with timestamp
      const branchName = `ultimate-automator-${Date.now()}`;
      const fileName = 'ultimate_automator/UA_E2E.spec.js';

      // Get repository details
      const [owner, repo] = selectedRepo.full_name.split('/');

      // Step 1: Get the default branch SHA
      const defaultBranchResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!defaultBranchResponse.ok) {
        throw new Error(
          `Failed to get repository info: ${defaultBranchResponse.statusText}`,
        );
      }

      const repoInfo = await defaultBranchResponse.json();
      const defaultBranch = repoInfo.default_branch;

      // Step 2: Get the latest commit SHA from default branch
      const branchResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!branchResponse.ok) {
        throw new Error(
          `Failed to get branch info: ${branchResponse.statusText}`,
        );
      }

      const branchInfo = await branchResponse.json();
      const latestCommitSha = branchInfo.object.sha;

      // Step 3: Create a new branch
      const createBranchResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: latestCommitSha,
          }),
        },
      );

      if (!createBranchResponse.ok) {
        throw new Error(
          `Failed to create branch: ${createBranchResponse.statusText}`,
        );
      }

      // Step 4: Check if the file already exists
      let fileSha = null;
      try {
        const existingFileResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}?ref=${branchName}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (existingFileResponse.ok) {
          const existingFile = await existingFileResponse.json();
          fileSha = existingFile.sha;
        }
      } catch {
        // File doesn't exist, which is fine
        console.log('File does not exist, will create new file');
      }

      // Step 5: Create or update the file
      const fileContent = Buffer.from(code).toString('base64');
      const createFileResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add/Update Ultimate Automator test code`,
            content: fileContent,
            branch: branchName,
            ...(fileSha ? { sha: fileSha } : {}),
          }),
        },
      );

      if (!createFileResponse.ok) {
        throw new Error(
          `Failed to create/update file: ${createFileResponse.statusText}`,
        );
      }

      // Step 6: Create the pull request
      const createPRResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title,
            body: description,
            head: branchName,
            base: defaultBranch,
          }),
        },
      );

      if (!createPRResponse.ok) {
        const errorData = await createPRResponse.json();
        throw new Error(
          `Failed to create PR: ${createPRResponse.statusText} - ${JSON.stringify(
            errorData,
          )}`,
        );
      }

      const prData = await createPRResponse.json();

      return {
        success: true,
        data: {
          pullRequestUrl: prData.html_url,
          pullRequestNumber: prData.number,
          branchName: branchName,
          fileName: fileName,
        },
      };
    } catch (error) {
      console.error('Error creating PR:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
