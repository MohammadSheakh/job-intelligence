import { Injectable } from '@nestjs/common';
import { appConfig, type AppConfig } from './app.config.js';

/** Provides a single configuration snapshot shared through the global configuration module. */
@Injectable()
export class AppConfigService {
  readonly app: AppConfig = appConfig();
}
