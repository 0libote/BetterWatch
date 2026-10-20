import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import webpack from 'webpack';
import packageJson from './package.json';

const services = ['netflix', 'amazon-prime', 'hbo-max'];
const names = ['Netflix', 'AmazonPrime', 'HboMax'];
const hosts = ['*://*.netflix.com/*', '*://*.primevideo.com/*',
  '*://*.amazon.com/*', '*://*.amazon.co.jp/*', '*://*.amazon.co.uk/*',
  '*://*.amazon.com.au/*', '*://*.amazon.de/*', '*://*.hbo.com/*',
  '*://*.hbomax.com/*'];
const manifest = {
  manifest_version: 3, name: 'BetterWatch', version: packageJson.version,
  minimum_chrome_version: '120',
  description: 'Auto-skip intros, recaps and credits, and track your watching with Trakt.',
  icons: { 16: 'images/betterwatch-16.png', 48: 'images/betterwatch-48.png', 128: 'images/betterwatch-128.png' },
  background: { service_worker: 'background.js' },
  action: { default_popup: 'popup.html', default_title: 'BetterWatch', default_icon: 'images/betterwatch-48.png' },
  options_ui: { page: 'options.html', open_in_tab: true },
  permissions: ['alarms', 'identity', 'scripting', 'storage', 'unlimitedStorage'],
  optional_permissions: ['notifications'],
  host_permissions: [...hosts, 'https://*.trakt.tv/*', 'https://*.themoviedb.org/*', 'https://*.uts.rafaelgomes.xyz/*'],
  optional_host_permissions: ['https://api.rollbar.com/*'],
  content_scripts: [
    { matches: hosts, js: ['auto-skip.js'], run_at: 'document_idle' },
    { matches: ['https://*.trakt.tv/apps*', 'https://app.trakt.tv/*'], js: ['trakt.js'] },
  ],
  default_locale: 'en',
  ...(process.env.CHROME_EXTENSION_KEY ? { key: process.env.CHROME_EXTENSION_KEY } : {}),
};

export default (env: {production?: boolean; watch?: boolean}): webpack.Configuration => ({
  mode: env.production ? 'production' : 'development',
  devtool: env.production ? false : 'source-map',
  entry: {
    background: './src/modules/background/background.ts',
    trakt: './src/modules/content/trakt/trakt.ts',
    popup: './src/modules/popup/popup.tsx', options: './src/modules/options/options.tsx',
    history: './src/modules/history/history.tsx', 'auto-skip': './src/skip/content.ts',
    ...Object.fromEntries(services.map(id => [id, `./src/services/${id}/${id}.ts`])),
  },
  output: { filename: '[name].js', path: path.resolve('build/chrome'), clean: true },
  module: { rules: [
    { test: /apis\.ts$/, loader: 'string-replace-loader', options: {
      search: '// @import-services-apis', replace: services.map((id,i) => `import '@/${id}/${names[i]}Api';`).join('\n'),
    } },
    { test: /services\.ts$/, loader: 'string-replace-loader', options: {
      search: '// @import-services', replace: services.map((id,i) => `import '@/${id}/${names[i]}Service';`).join('\n'),
    } },
    { test: /\.(woff2?|png|jpg)$/, type: 'asset/resource', generator: { filename: 'images/[name][ext]' } },
    { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    { test: /\.[tj]sx?$/, exclude: /node_modules/, loader: 'babel-loader' },
  ] },
  plugins: [
    new webpack.DefinePlugin(Object.fromEntries(['TRAKT_CLIENT_ID', 'TRAKT_CLIENT_SECRET', 'ROLLBAR_TOKEN', 'TMDB_API_KEY', 'REACT_ENV'].map(key => [`process.env.${key}`, JSON.stringify(process.env[key] || '')]))),
    ...['popup', 'options', 'history'].map(page => new HtmlWebpackPlugin({
      templateContent: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BetterWatch · ${page}</title></head><body><div id="root"></div><script src="${page}.js"></script></body></html>`,
      filename: `${page}.html`, inject: false,
    })),
    { apply(compiler) { compiler.hooks.afterEmit.tapPromise('ChromePackage', async () => {
      fs.copySync('src/_locales', 'build/chrome/_locales');
      fs.copySync('assets/icons', 'build/chrome/images');
      fs.copySync('LICENSE', 'build/chrome/LICENSE');
      fs.copySync('THIRD_PARTY_NOTICES.md', 'build/chrome/THIRD_PARTY_NOTICES.md');
      fs.copySync('licenses', 'build/chrome/licenses');
      fs.writeJsonSync('build/chrome/manifest.json', manifest, {spaces: 2});
      if (env.production) {
        fs.ensureDirSync('dist');
        const archive = archiver('zip', {zlib: {level: 9}});
        await new Promise<void>((resolve,reject) => {
          const output = fs.createWriteStream('dist/betterwatch-chrome.zip');
          output.on('close',resolve); output.on('error',reject); archive.on('error',reject);
          archive.pipe(output); archive.directory('build/chrome',false); void archive.finalize();
        });
      }
    }); } },
  ],
  resolve: {extensions: ['.js','.ts','.tsx','.json'],plugins: [new TsconfigPathsPlugin()]},
  watch: !!env.watch,
  stats: 'errors-warnings',
  performance: {hints: false},
});
