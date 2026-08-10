#!/usr/bin/env node
// Proves apps/nfs-demo consumes `ngx-foundation-sites` as a real, extracted
// npm package fetched from the local Verdaccio registry - not the monorepo's
// npm-workspace symlink and not tsconfig-path-mapped source.
//
// The real npmjs registry already has a published `ngx-foundation-sites@0.0.1`
// (this repo's own historical release), and Verdaccio's uplink proxy will
// refuse to let us publish over that version locally (EPUBLISHCONFLICT-style
// rejection). So this script builds the CURRENT workspace source, republishes
// it to local Verdaccio under a disposable prerelease tag/version that cannot
// collide with anything upstream, and points apps/nfs-demo's dependency at
// that exact version. This keeps every proof step scoped to local Verdaccio
// storage, never the npmjs uplink cache.
//
// Steps:
//   1. Ensure the local Verdaccio registry (root "local-registry" Nx target)
//      is running, starting it in the background if needed.
//   2. Build ngx-foundation-sites from current source.
//   3. Copy the build output to a scratch dir, bump its version to a fixed
//      disposable prerelease, and publish that to local Verdaccio only.
//   4. Point apps/nfs-demo's package.json dependency at that exact version
//      and run `npm install` from *inside* apps/nfs-demo (its own isolated
//      install, using its own .npmrc registry override).
//   5. Assert node_modules/ngx-foundation-sites is a real extracted directory
//      (not a symlink) and matches the disposable version we just published.
//   6. Build BOTH of apps/nfs-demo's build targets - the CSR one behind the
//      dev-server and static-serve hosts, and the SSR one behind the
//      Express/node host - and assert neither output references
//      packages/ngx-foundation-sites/src (the monorepo source path) while both
//      still contain the nfsButton attribute selector.
//
// Why the SSR half exists: D016 re-scoped a real SSR host out of M001 partly
// because SSR wiring risks reopening this isolation, and ticket 12's SSR
// measurements ran against workspace source rather than the published package.
// Scanning the server bundle is what closes that.

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_DIR = path.join(ROOT, 'apps', 'nfs-demo');
const LIB_DIST_DIR = path.join(ROOT, 'dist', 'packages', 'ngx-foundation-sites');
const APP_DIST_DIR = path.join(ROOT, 'dist', 'apps', 'nfs-demo');
const APP_SSR_DIST_DIR = path.join(ROOT, 'dist', 'apps', 'nfs-demo-ssr');
const SCRATCH_DIR = path.join(ROOT, 'tmp', 'registry-proof', 'pkg');
const LOCAL_REGISTRY_URL = 'http://localhost:4873';
const PROOF_PKG_NAME = 'ngx-foundation-sites';
const PROOF_VERSION = '0.0.1-registryproof.0';
const PROOF_TAG = 'registry-proof';
const SOURCE_PATH_NEEDLES = [
  'packages/ngx-foundation-sites/src',
  'packages\\ngx-foundation-sites\\src',
  'packages\\\\ngx-foundation-sites\\\\src',
];

function log(message) {
  console.log(`[verify-registry-consumption] ${message}`);
}

function fail(message) {
  console.error(`[verify-registry-consumption] FAIL: ${message}`);
  process.exit(1);
}

function run(command, cwd) {
  log(`$ ${command}`);
  return execSync(command, { cwd, stdio: 'inherit', encoding: 'utf8' });
}

function runCapture(command, cwd) {
  return execSync(command, { cwd, encoding: 'utf8' });
}

function isRegistryUp() {
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port: 4873, path: '/', timeout: 1000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForRegistry(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isRegistryUp()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureRegistryRunning() {
  if (await isRegistryUp()) {
    log(`Local Verdaccio registry already running at ${LOCAL_REGISTRY_URL}.`);
    return;
  }
  log('Local Verdaccio registry not running - starting it in the background...');
  fs.mkdirSync(path.join(ROOT, 'tmp', 'local-registry'), { recursive: true });
  const logFd = fs.openSync(path.join(ROOT, 'tmp', 'local-registry', 'verdaccio.log'), 'a');
  const child = spawn('npx', ['nx', 'run', '@ngx-foundation-sites/source:local-registry'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    shell: true,
  });
  child.unref();
  const up = await waitForRegistry(30000);
  if (!up) fail('Local Verdaccio registry did not become ready within 30s. Check tmp/local-registry/verdaccio.log.');
  log(`Local Verdaccio registry is up at ${LOCAL_REGISTRY_URL} (pid ${child.pid}).`);
}

function buildLibrary() {
  log('Building ngx-foundation-sites from current source...');
  run('npx nx build ngx-foundation-sites --skip-nx-cache', ROOT);
  if (!fs.existsSync(path.join(LIB_DIST_DIR, 'package.json'))) {
    fail(`Expected build output at ${LIB_DIST_DIR}/package.json but it does not exist.`);
  }
}

function preparePublishablePackage() {
  log(`Preparing disposable proof version ${PROOF_VERSION} in scratch dir (avoids colliding with the real npmjs-published ${PROOF_PKG_NAME}@0.0.1)...`);
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(SCRATCH_DIR), { recursive: true });
  fs.cpSync(LIB_DIST_DIR, SCRATCH_DIR, { recursive: true });
  const pkgJsonPath = path.join(SCRATCH_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  pkg.version = PROOF_VERSION;
  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function publishProofPackage() {
  log(`Publishing ${PROOF_PKG_NAME}@${PROOF_VERSION} to local Verdaccio only (tag: ${PROOF_TAG})...`);
  try {
    run(`npm unpublish ${PROOF_PKG_NAME}@${PROOF_VERSION} --registry ${LOCAL_REGISTRY_URL} --force`, SCRATCH_DIR);
  } catch {
    log('No prior proof version to unpublish (expected on first run).');
  }
  run(`npm publish --registry ${LOCAL_REGISTRY_URL} --tag ${PROOF_TAG}`, SCRATCH_DIR);

  const storedTarball = path.join(ROOT, 'tmp', 'local-registry', 'storage', PROOF_PKG_NAME, `${PROOF_PKG_NAME}-${PROOF_VERSION}.tgz`);
  if (!fs.existsSync(storedTarball)) {
    fail(`Expected published tarball at ${storedTarball} - publish did not land in local Verdaccio storage.`);
  }
  log(`Confirmed tarball stored locally at ${storedTarball} (proves this is a real local-registry publish, not an npmjs uplink pass-through).`);
}

function pinAppDependency() {
  const pkgJsonPath = path.join(APP_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.dependencies[PROOF_PKG_NAME] !== PROOF_VERSION) {
    pkg.dependencies[PROOF_PKG_NAME] = PROOF_VERSION;
    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    log(`Pinned apps/nfs-demo/package.json dependency to ${PROOF_PKG_NAME}@${PROOF_VERSION}.`);
  } else {
    log(`apps/nfs-demo/package.json already pinned to ${PROOF_PKG_NAME}@${PROOF_VERSION}.`);
  }
}

// The proof version is a FIXED string, so republishing it replaces the tarball
// behind a version apps/nfs-demo's lockfile already pins by integrity hash.
// `npm install` then satisfies the range from cache and silently keeps the
// PREVIOUS build - observed: a reinstall after the SCSS public-API rename left
// the old scss/nfs-button.scss layout in place. Dropping the lockfile entry
// forces re-resolution against the registry's current metadata.
function dropLockfileEntryForProofPackage() {
  const lockPath = path.join(APP_DIR, 'package-lock.json');
  fs.rmSync(path.join(APP_DIR, 'node_modules', PROOF_PKG_NAME), { recursive: true, force: true });

  if (!fs.existsSync(lockPath)) {
    return;
  }

  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  if (lock.packages?.[`node_modules/${PROOF_PKG_NAME}`]) {
    delete lock.packages[`node_modules/${PROOF_PKG_NAME}`];
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    log(`Dropped the ${PROOF_PKG_NAME} lockfile entry so the republished tarball is refetched.`);
  }
}

function installApp() {
  log('Running isolated `npm install` inside apps/nfs-demo (own .npmrc, registry-only resolution)...');
  dropLockfileEntryForProofPackage();
  run('npm install --prefer-online', APP_DIR);
}

function verifyInstalledPackageIsRealCopy() {
  const installedDir = path.join(APP_DIR, 'node_modules', PROOF_PKG_NAME);
  if (!fs.existsSync(installedDir)) {
    fail(`Expected ${installedDir} to exist after npm install.`);
  }
  const stat = fs.lstatSync(installedDir);
  if (stat.isSymbolicLink()) {
    fail(`${installedDir} is a symlink - npm workspaces auto-linked the source package instead of installing from the registry.`);
  }
  if (!stat.isDirectory()) {
    fail(`${installedDir} is not a directory.`);
  }
  const installedPkg = JSON.parse(fs.readFileSync(path.join(installedDir, 'package.json'), 'utf8'));
  if (installedPkg.version !== PROOF_VERSION) {
    fail(`Installed ${PROOF_PKG_NAME} version is ${installedPkg.version}, expected the registry proof version ${PROOF_VERSION}.`);
  }
  if (!fs.existsSync(path.join(installedDir, 'fesm2022', 'ngx-foundation-sites.mjs'))) {
    fail(`Installed package is missing the built fesm2022 bundle - does not look like a real ng-packagr build output.`);
  }
  log(`Confirmed apps/nfs-demo/node_modules/${PROOF_PKG_NAME} is a real extracted directory (not a symlink) at version ${installedPkg.version}.`);
}

function buildApp() {
  log('Building apps/nfs-demo (CSR target, behind the dev-server and static-serve hosts)...');
  run('npx nx build nfs-demo --skip-nx-cache', ROOT);
  if (!fs.existsSync(APP_DIST_DIR)) {
    fail(`Expected build output at ${APP_DIST_DIR} but it does not exist.`);
  }

  log('Building apps/nfs-demo (SSR target, behind the Express/node and dev-SSR hosts)...');
  run('npx nx build-ssr nfs-demo --skip-nx-cache', ROOT);
  if (!fs.existsSync(path.join(APP_SSR_DIST_DIR, 'server', 'server.mjs'))) {
    fail(`Expected SSR server bundle at ${APP_SSR_DIST_DIR}/server/server.mjs but it does not exist.`);
  }
}

function listFilesRecursive(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function verifyOutputDirHasNoSourceLeakage(label, dir) {
  const files = listFilesRecursive(dir);

  let sawNfsButtonReference = false;
  for (const file of files) {
    const contents = fs.readFileSync(file, 'utf8');
    for (const needle of SOURCE_PATH_NEEDLES) {
      if (contents.includes(needle)) {
        fail(`${label} output ${file} references monorepo source path "${needle}" - app resolved ngx-foundation-sites from source, not the installed package.`);
      }
    }
    // `nfsButton` is the attribute selector, so it has to survive into the
    // compiled template. The class name `NfsButton` and the old `nfs-button`
    // literal do not: production minification mangles the former, and ticket
    // 09 deleted the CSS-in-JS path that carried the latter.
    if (contents.includes('nfsButton')) {
      sawNfsButtonReference = true;
    }
  }
  if (!sawNfsButtonReference) {
    fail(`${label} output contains no reference to the nfsButton selector at all - the check would pass vacuously without this.`);
  }
  log(`Confirmed ${label} output has no reference to packages/ngx-foundation-sites/src, and does reference the nfsButton selector.`);
}

function verifyBuildOutputHasNoSourceLeakage() {
  verifyOutputDirHasNoSourceLeakage('CSR build', APP_DIST_DIR);
  verifyOutputDirHasNoSourceLeakage('SSR build', APP_SSR_DIST_DIR);
}

async function main() {
  await ensureRegistryRunning();
  buildLibrary();
  preparePublishablePackage();
  publishProofPackage();
  pinAppDependency();
  installApp();
  verifyInstalledPackageIsRealCopy();
  buildApp();
  verifyBuildOutputHasNoSourceLeakage();
  log('PASS: apps/nfs-demo consumes ngx-foundation-sites from the local Verdaccio registry as a real built package, not the monorepo source - in the CSR build AND the SSR build.');
}

main().catch((error) => {
  fail(error?.stack ?? String(error));
});
