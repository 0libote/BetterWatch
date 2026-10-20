import { cp, mkdir, rm } from 'node:fs/promises';
import { createWriteStream, watch } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { createManifest } from './manifest';
import { validateBuild } from './validate-build';

const root = path.resolve(import.meta.dir, '..');
const outdir = path.join(root, 'build/chrome');
const watching = process.argv.includes('--watch');
const production = !watching && !process.argv.includes('--development');
const entries = {
  background: 'src/modules/background/background.ts',
  trakt: 'src/modules/content/trakt/trakt.ts',
  app: 'src/modules/app/index.tsx',
  'auto-skip': 'src/skip/content.ts',
  netflix: 'src/services/netflix/netflix.ts',
  'amazon-prime': 'src/services/amazon-prime/amazon-prime.ts',
  'hbo-max': 'src/services/hbo-max/hbo-max.ts',
};

async function build() {
  const started = performance.now();
  const packageJson = await Bun.file(path.join(root, 'package.json')).json();
  await rm(outdir, { recursive: true, force: true });

  // Virtual entry points give content scripts stable names without generating source files.
  const files = Object.fromEntries(
    Object.entries(entries).map(([name, source]) => [
      path.join(root, '.betterwatch-entry', `${name}.ts`),
      `import ${JSON.stringify(path.join(root, source))};`,
    ]),
  );
  const define: Record<string, string> = {
    'process.env.NODE_ENV': JSON.stringify(
      production ? 'production' : 'development',
    ),
  };
  for (const key of [
    'TRAKT_CLIENT_ID',
    'TRAKT_CLIENT_SECRET',
    'ROLLBAR_TOKEN',
    'TMDB_API_KEY',
    'REACT_ENV',
  ]) {
    define[`process.env.${key}`] = JSON.stringify(process.env[key] || '');
  }
  const result = await Bun.build({
    entrypoints: Object.keys(files),
    files,
    root,
    outdir,
    target: 'browser',
    format: 'iife',
    splitting: false,
    minify: production,
    sourcemap: production ? 'none' : 'linked',
    naming: { entry: '[name].[ext]', asset: 'images/[name]-[hash].[ext]' },
    env: 'disable',
    define,
  });
  for (const log of result.logs) console.error(log);
  if (!result.success)
    throw new Error('Bun could not build the Chrome extension.');

  await Promise.all([
    cp(path.join(root, 'src/_locales'), path.join(outdir, '_locales'), {
      recursive: true,
    }),
    cp(path.join(root, 'assets/icons'), path.join(outdir, 'images'), {
      recursive: true,
    }),
    cp(path.join(root, 'licenses'), path.join(outdir, 'licenses'), {
      recursive: true,
    }),
    ...['LICENSE', 'THIRD_PARTY_NOTICES.md'].map((file) =>
      cp(path.join(root, file), path.join(outdir, file)),
    ),
    Bun.write(
      path.join(outdir, 'manifest.json'),
      JSON.stringify(createManifest(packageJson.version), null, 2) + '\n',
    ),
    Bun.write(
      path.join(outdir, 'app.html'),
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><link rel="icon" href="images/betterwatch-48.png"><link rel="stylesheet" href="app.css"><title>BetterWatch</title></head><body><div id="root"></div><script src="app.js"></script></body></html>',
    ),
  ]);
  await validateBuild(outdir, production);

  if (production) {
    await mkdir(path.join(root, 'dist'), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(
        path.join(root, 'dist/betterwatch-chrome.zip'),
      );
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', reject);
      archive.pipe(output);
      archive.directory(outdir, false);
      void archive.finalize().catch(reject);
    });
    const zip = Bun.file(path.join(root, 'dist/betterwatch-chrome.zip'));
    await Bun.write(
      path.join(root, 'dist/SHA256SUMS'),
      `${Bun.CryptoHasher.hash('sha256', await zip.arrayBuffer(), 'hex')}  betterwatch-chrome.zip\n`,
    );
  }
  console.log(
    `Built Chrome extension in ${Math.round(performance.now() - started)}ms${production ? ' → dist/betterwatch-chrome.zip' : ''}`,
  );
}

if (watching) {
  let running = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout>;
  async function rebuild() {
    dirty = true;
    if (running) return;
    running = true;
    try {
      while (dirty) {
        dirty = false;
        try {
          await build();
        } catch (error) {
          console.error(error);
        }
      }
    } finally {
      running = false;
    }
  }
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), 100);
  };
  const watchers = ['src', 'assets', 'licenses'].map((dir) =>
    watch(path.join(root, dir), { recursive: true }, changed),
  );
  const stop = () => {
    clearTimeout(timer);
    watchers.forEach((watcher) => watcher.close());
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await rebuild();
  console.log(
    'Watching source, assets, and licenses. Reload BetterWatch in Chrome after changes.',
  );
} else {
  await build();
}
