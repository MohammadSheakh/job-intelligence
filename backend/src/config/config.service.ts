import { Injectable } from '@nestjs/common';
import { appConfig, type AppConfig } from './app.config.js';

@Injectable()
export class AppConfigService {
  readonly app: AppConfig = appConfig();
}
