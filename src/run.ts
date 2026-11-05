import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { Config, State } from './form';

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

/**
 * Run the vault's Podarcis script and parse its JSON; stderr becomes the log or the error.
 * Without an installed skill, or to update it, run the latest release's script from GitHub, which installs it;
 * an update also runs setup, which moves files to where the new release expects them.
 */
export async function runVault(
  uv: string, skill: string, root: string, config?: Config, update = false,
): Promise<{ state: State; log: string }> {
  let script = path.resolve(root, skill, 'scripts', 'podarcis.py');
  let log = '';
  if (update || !existsSync(script)) {
    const response = await fetch(`https://api.github.com/repos/${SKILL_REPO}/releases/latest`);
    if (!response.ok) throw new Error(`Could not find the latest ${SKILL_REPO} release: HTTP ${response.status}.`);
    const tag = ((await response.json()) as { tag_name: string }).tag_name;
    script = `https://raw.githubusercontent.com/${SKILL_REPO}/${tag}/skills/podarcis/scripts/podarcis.py`;
    log = `Installed Podarcis ${tag}.\n`;
  }
  const { out, err } = await exec(
    uv, ['run', '--quiet', script, '--root', root, ...(config ? ['setup', '--stdin'] : update ? ['setup'] : ['config'])],
    root, config ? JSON.stringify(config) : '',
  );
  return { state: JSON.parse(out), log: (log + err).trim() };
}
