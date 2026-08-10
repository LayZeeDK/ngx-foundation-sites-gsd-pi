import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { RenderMode, provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';

// Hydration has to be provided on BOTH sides of the render: the server reads
// the same IS_HYDRATION_DOM_REUSE_ENABLED token to decide whether to annotate
// its output, and the client reads it to reuse the server's DOM instead of
// re-creating it. Ticket 12 measured what that buys for styling -- the client
// adopts the server-emitted `<style ng-app-id="ng">` node by identity rather
// than appending a duplicate.
//
// This deliberately does NOT live in appConfig. The two CSR hosts share that
// config, and hydration requested with no server payload logs NG0505 in
// development (core.mjs, the ENVIRONMENT_INITIALIZER guarded by
// `!isClientRenderModeEnabled(doc)`). Keeping it here leaves the CSR hosts
// byte-identical to what they were before SSR existed.
export const hydratedAppConfig: ApplicationConfig = mergeApplicationConfig(
  appConfig,
  {
    providers: [provideClientHydration()],
  },
);

// RenderMode.Server, not the schematic's default RenderMode.Prerender. Without
// an explicit render mode the builder prerenders `/` at build time and the
// Express host just serves that file, so the host would verify SSG rather than
// the server-render path it exists to cover -- measured: prerendered-routes.json
// listed `/`, and browser/index.html shipped with the button already rendered.
export const serverAppConfig: ApplicationConfig = mergeApplicationConfig(
  hydratedAppConfig,
  {
    providers: [
      provideServerRendering(
        withRoutes([{ path: '**', renderMode: RenderMode.Server }]),
      ),
    ],
  },
);
