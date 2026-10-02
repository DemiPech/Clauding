/**
 * Assemble le SDK officiel CardNexus (https://github.com/cardnexus/cardnexus-sdk,
 * en TypeScript, non publie sur npm) en un seul module JavaScript, embarque
 * dans l'app : assets/www/js/vendor/cardnexus-sdk.js.
 *
 * La version utilisee est figee dans SDK_VERSION (un commit du depot). Pour
 * changer de version : modifier SDK_VERSION, puis `npm run build`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/cardnexus/cardnexus-sdk';
const COMMIT = fs.readFileSync(path.join(HERE, 'SDK_VERSION'), 'utf8').trim();
const OUT_DIR = path.resolve(HERE, '../app/src/main/assets/www/js/vendor');

// Les sources : un dossier deja clone (SDK_SOURCE), sinon un clone du commit fige.
let source = process.env.SDK_SOURCE;
if (!source) {
  source = fs.mkdtempSync(path.join(os.tmpdir(), 'cardnexus-sdk-'));
  const git = (...args) => execFileSync('git', args, { cwd: source, stdio: 'inherit' });
  git('init', '-q');
  git('remote', 'add', 'origin', REPO);
  git('fetch', '-q', '--depth', '1', 'origin', COMMIT);
  git('checkout', '-q', 'FETCH_HEAD');
}
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source }).toString().trim();
if (head !== COMMIT) throw new Error(`Sources au commit ${head}, SDK_VERSION demande ${COMMIT}.`);
const version = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version;

fs.mkdirSync(OUT_DIR, { recursive: true });
await build({
  entryPoints: [path.join(source, 'src/index.ts')],
  outfile: path.join(OUT_DIR, 'cardnexus-sdk.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  nodePaths: [path.join(HERE, 'node_modules')],
  banner: {
    js: `// SDK CardNexus ${version} (${REPO}, commit ${COMMIT}), Apache-2.0.\n// Fichier genere par android/sdk/build.mjs : ne pas modifier a la main.`,
  },
});
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(OUT_DIR, 'cardnexus-sdk.LICENSE.txt'));
console.log(`cardnexus-sdk.js genere (SDK ${version}, commit ${COMMIT.slice(0, 10)}).`);
