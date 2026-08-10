import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { hydratedAppConfig } from './app/app.config.ssr';

// Browser entry for the two SSR hosts. Identical to main.ts apart from the
// hydration providers -- see app.config.ssr.ts for why they are not in the
// shared appConfig.
bootstrapApplication(AppComponent, hydratedAppConfig).catch((error: unknown) =>
  console.error(error),
);
