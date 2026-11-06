import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { Config, Nest, State } from './form';

const SKILL_REPO = 'XicuM/podarcis-skill';

/** Run a command in the vault; resolve with its stdout and stderr, reject with stderr on failure. */
function exec(command: string, args: string[], cwd: string, input = ''): Promise<{ out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`Could not start ${command}: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(err.trim() || `${command} exited with status ${code}`));
    });
    // A command that exits without reading stdin fails the write; its exit status is the result.
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

/** What a PodarcisNest server tells the panel about this workspace, or undefined in a standalone vault. */
export function readNest(root: string): Nest | undefined {
  try {
    const nest = JSON.parse(readFileSync(path.join(root, '.agents', 'podarcis', 'nest.json'), 'utf8'));
    return nest && typeof nest === 'object' && typeof nest.sources_mode === 'string'
      ? { sources_mode: nest.sources_mode, locked: nest.locked === true, account_url: typeof nest.account_url === 'string' ? nest.account_url : undefined }
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Run the vault's Podarcis script and parse its JSON; stderr becomes the log or the error.
 * Without an installed skill, run the latest release's script from GitHub, which installs it.
 * Upgrades are not offered here: PodarcisNest provides the skill, and a standalone vault reruns
 * setup with a newer release tag.
 */
export async function runVault(
  uv: string, skill: string, root: string, config?: Config,
): Promise<{ state: State; log: string }> {
  let script = path.resolve(root, skill, 'scripts', 'podarcis.py');
  let log = '';
  if (!existsSync(script)) {
    const response = await fetch(`https://api.github.com/repos/${SKILL_REPO}/releases/latest`);
    if (!response.ok) throw new Error(`Could not find the latest ${SKILL_REPO} release: HTTP ${response.status}.`);
    const tag = ((await response.json()) as { tag_name: string }).tag_name;
    script = `https://raw.githubusercontent.com/${SKILL_REPO}/${tag}/skills/podarcis/scripts/podarcis.py`;
    log = `Installed Podarcis ${tag}.\n`;
  }
  const { out, err } = await exec(
    uv, ['run', '--quiet', script, '--root', root, ...(config ? ['setup', '--stdin'] : ['config'])],
    root, config ? JSON.stringify(config) : '',
  );
  const state: State = JSON.parse(out);
  const nest = readNest(root);
  return { state: nest ? { ...state, nest } : state, log: (log + err).trim() };
}
