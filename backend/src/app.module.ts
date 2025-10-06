import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GitIntegrationController } from './controllers/git-integration.controller';
import { GitIntegrationService } from './services/git-integration.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, GitIntegrationController],
  providers: [AppService, GitIntegrationService],
})
export class AppModule {}
