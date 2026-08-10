import {
  BootstrapContext,
  bootstrapApplication,
} from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { serverAppConfig } from './app/app.config.ssr';

// The BootstrapContext argument is not optional in practice: omitting it makes
// build-time route extraction fail with NG0401 PLATFORM_NOT_FOUND (ticket 12).
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, serverAppConfig, context);

export default bootstrap;
