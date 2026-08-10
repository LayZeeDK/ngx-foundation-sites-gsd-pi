import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

// Constructed on first request, not at module scope as the
// @schematics/angular template does. AngularAppEngine reads the build-injected
// app-engine manifest in an instance field initializer, and this module is
// imported by the builder's own route extractor before that manifest is set --
// an eager `new AngularNodeAppEngine()` fails the production build with
// "Angular app engine manifest is not set".
//
// allowedHosts is required, not cosmetic: Angular 22's SSRF guard compares the
// request hostname against this list and answers HTTP 400 for anything not on
// it, so a bare `new AngularNodeAppEngine()` rejects every localhost request
// the e2e suite makes (ticket 12).
let angularApp: AngularNodeAppEngine | undefined;

function getAngularApp(): AngularNodeAppEngine {
  angularApp ??= new AngularNodeAppEngine({ allowedHosts: ['localhost'] });

  return angularApp;
}

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((request, response, next) => {
  getAngularApp()
    .handle(request)
    .then((rendered) =>
      rendered ? writeResponseToNodeResponse(rendered, response) : next(),
    )
    .catch(next);
});

// Only listens when run directly (`node dist/apps/nfs-demo-ssr/server/server.mjs`).
// The dev server in SSR mode imports reqHandler below instead, so this block
// must stay guarded or the two hosts fight over the port.
if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 4202);
  // No error parameter: express 4's listen callback takes none, unlike the
  // express 5 shape the @schematics/angular SSR template assumes.
  app.listen(port, () => {
    console.log(`nfs-demo SSR host listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
