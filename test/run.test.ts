import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { runVault } from '../src/run.ts';

const STATE = { config: { agents: [], repos: {}, mcp: [], skills: [] }, catalogue: {}, repos: {} };
const PATH = process.env.PATH;
let root: string;
let bin: string;

/** Put a fake command on PATH that runs the given shell body in the vault. */
function fake(name: string, body: string) {
  writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
  chmodSync(path.join(bin, name), 0o755);
}

/** Create an installed skill's vault.py at the given folder. */
function skillAt(dir: string) {
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  writeFileSync(path.join(dir, 'scripts/vault.py'), '');
  return dir;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'podarcis-vault-'));
  bin = mkdtempSync(path.join(tmpdir(), 'podarcis-bin-'));
  process.env.PATH = `${bin}${path.delimiter}${PATH}`;
  // uv records its arguments and stdin, then prints the vault state as vault.py would.
  fake('uv', `echo "$@" > uv.args; cat > uv.stdin; echo '${JSON.stringify(STATE)}'; echo 'setup log' >&2`);
  fake('git', 'touch git.ran; exit 9');
  fake('npx', 'touch npx.ran; exit 9');
});
afterEach(() => { process.env.PATH = PATH; });

test('reads the configuration with the installed skill', async () => {
  skillAt(path.join(root, '.agents/skills/podarcis'));
  const { state, log } = await runVault('uv', '.agents/skills/podarcis', root);
  assert.deepEqual(state, STATE);
  assert.equal(log, 'setup log');
  const script = path.join(root, '.agents/skills/podarcis/scripts/vault.py');
  assert.equal(readFileSync(path.join(root, 'uv.args'), 'utf8').trim(), `run --quiet ${script} --root ${root} config`);
  assert.ok(!existsSync(path.join(root, 'git.ran')) && !existsSync(path.join(root, 'npx.ran')));
});

test('applies a configuration through setup --stdin', async () => {
  const config = { agents: ['claude'], repos: { sources: null, wiki: null, workspace: null }, mcp: [], skills: [] };
  await runVault('uv', skillAt(mkdtempSync(path.join(tmpdir(), 'podarcis-skill-'))), root, config);
  assert.match(readFileSync(path.join(root, 'uv.args'), 'utf8'), /setup --stdin$/m);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, 'uv.stdin'), 'utf8')), config);
});

test('installs the latest skill release before the first run', async () => {
  fake('git', `echo "$@" > git.args; printf 'abc\\trefs/tags/v2.0.0\\ndef\\trefs/tags/v1.1.0\\n'`);
  fake('npx', 'echo "$@" > npx.args; mkdir -p .agents/skills/podarcis/scripts');
  const { state, log } = await runVault('uv', '.agents/skills/podarcis', root);
  assert.deepEqual(state, STATE);
  assert.match(log, /^Installed Podarcis v2\.0\.0\./);
  assert.match(readFileSync(path.join(root, 'git.args'), 'utf8'), /--sort=-version:refname https:\/\/github\.com\/XicuM\/podarcis-skill\.git v\*/);
  assert.match(readFileSync(path.join(root, 'agents.toml'), 'utf8'), /source = "XicuM\/podarcis-skill"\nref = "v2\.0\.0"/);
  assert.equal(readFileSync(path.join(root, 'npx.args'), 'utf8').trim(), '--yes @sentry/dotagents@3.4.0 --project install');
});

test('reports a missing release without installing', async () => {
  fake('git', 'exit 0');
  await assert.rejects(runVault('uv', '.agents/skills/podarcis', root), /No release of XicuM\/podarcis-skill found/);
  assert.ok(!existsSync(path.join(root, 'npx.ran')));
  assert.ok(!existsSync(path.join(root, 'agents.toml')));
});

test('reports a failed skill install', async () => {
  fake('git', `printf 'abc\\trefs/tags/v1.1.0\\n'`);
  fake('npx', 'echo tag v1.1.0 not found >&2; exit 1');
  await assert.rejects(runVault('uv', '.agents/skills/podarcis', root), /tag v1\.1\.0 not found/);
});

test('reports a missing uv', async () => {
  const skill = skillAt(mkdtempSync(path.join(tmpdir(), 'podarcis-skill-')));
  await assert.rejects(runVault('/nonexistent/uv', skill, root), /Could not start \/nonexistent\/uv/);
});
