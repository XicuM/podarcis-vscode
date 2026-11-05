import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
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
    child.stdin.end(input);
  });
}

/**
 * Run the vault's Podarcis script and parse its JSON; stderr becomes the log or the error.
 * Without an installed skill, first install the latest podarcis-skill release with dotagents;
 * setup then keeps that release pinned and rewrites agents.toml from podarcis.yaml.
 */
export async function runVault(
  uv: string, skill: string, root: string, config?: Config,
): Promise<{ state: State; log: string }> {
  let script = path.resolve(root, skill, 'scripts', 'vault.py');
  let log = '';
  if (!existsSync(script)) {
    const tags = await exec('git', ['ls-remote', '--tags', '--refs', '--sort=-version:refname',
      `https://github.com/${SKILL_REPO}.git`, 'v*'], root);
    const tag = tags.out.split('\n')[0]?.split('refs/tags/')[1];
    if (!tag) throw new Error(`No release of ${SKILL_REPO} found.`);
    if (!existsSync(path.join(root, 'agents.toml'))) {
      writeFileSync(path.join(root, 'agents.toml'), 'version = 1\nagents = []\n\n[[skills]]\nname = "podarcis"\n'
        + `source = "${SKILL_REPO}"\nref = "${tag}"\npath = "skills/podarcis"\n`);
    }
    const { out, err } = await exec('npx', ['--yes', '@sentry/dotagents@3.4.0', '--project', 'install'], root);
    log = `Installed Podarcis ${tag}.\n${out}${err}`;
    script = path.join(root, '.agents/skills/podarcis/scripts/vault.py');
  }
  const { out, err } = await exec(
    uv, ['run', '--quiet', script, '--root', root, ...(config ? ['setup', '--stdin'] : ['config'])],
    root, config ? JSON.stringify(config) : '',
  );
  return { state: JSON.parse(out), log: (log + err).trim() };
}
