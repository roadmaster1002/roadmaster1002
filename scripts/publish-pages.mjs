import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Publishes only the compiled, browser-local website. No API, .env or user
// browser data is included. Uses an isolated index; never resets the checkout.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-pages');
if (!existsSync(path.join(output, 'index.html'))) throw new Error('Run npm run build:pages first.');
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
const gitDirectory = git(['rev-parse', '--absolute-git-dir']);
const remote = git(['remote', 'get-url', 'origin']);
if (remote !== 'https://github.com/roadmaster1002/roadmaster1002.git') throw new Error('Check the repository and Pages base path before deploying to another destination.');
writeFileSync(path.join(output, '.nojekyll'), '');
const offline = path.join(root, 'dist-offline', 'index.html');
if (existsSync(offline)) copyFileSync(offline, path.join(output, 'CHEM2-offline.html'));
let previous = '';
const advertised = git(['ls-remote', 'origin', 'refs/heads/gh-pages']);
if (advertised) {
  git(['fetch', 'origin', 'refs/heads/gh-pages']);
  previous = git(['rev-parse', 'FETCH_HEAD']);
}
const temporary = mkdtempSync(path.join(os.tmpdir(), 'chem2-publish-'));
try {
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, 'index') };
  const atOutput = (args, options = {}) => git([`--git-dir=${gitDirectory}`, `--work-tree=${output}`, ...args], { cwd: output, env, ...options });
  atOutput(['add', '--force', '--all', '--', '.']);
  const tree = atOutput(['write-tree']);
  const commit = git(['commit-tree', tree, ...(previous ? ['-p', previous] : [])], { input: 'Deploy CHEM2 industry intelligence website\n' });
  // Normal push deliberately refuses to overwrite concurrent changes.
  git(['push', 'origin', `${commit}:refs/heads/gh-pages`], { stdio: ['pipe', 'pipe', 'inherit'] });
  console.log(`Published static files to gh-pages (${commit.slice(0, 10)}).`);
  console.log('GitHub Settings > Pages: Deploy from a branch > gh-pages > / (root) > Save.');
  console.log('Expected address after GitHub completes deployment: https://roadmaster1002.github.io/roadmaster1002/');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
