import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { runVault } from '../src/run.ts';

const STATE = { config: { repos: {}, mcp: [], skills: [] }, catalogue: {}, repos: {} };
const PATH = process.env.PATH;
const FETCH = globalThis.fetch;
let root: string;
let bin: string;
let requested: string[];

/** Put a fake command on PATH that runs the given shell body in the vault. */
function fake(name: string, body: string) {
  writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
  chmodSync(path.join(bin, name), 0o755);
}

/** Create an installed skill's podarcis.py at the given folder. */
function skillAt(dir: string) {
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  writeFileSync(path.join(dir, 'scripts/podarcis.py'), '');
  return dir;
}

/** Answer GitHub's latest-release request with the given status and body. */
function release(status: number, body: unknown) {
  globalThis.fetch = (async (url: string) => {
    requested.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'podarcis-vault-'));
  bin = mkdtempSync(path.join(tmpdir(), 'podarcis-bin-'));
  requested = [];
  process.env.PATH = `${bin}${path.delimiter}${PATH}`;
  // uv records its arguments and stdin, then prints the vault state as podarcis.py would.
  fake('uv', `echo "$@" > uv.args; cat > uv.stdin; echo '${JSON.stringify(STATE)}'; echo 'setup log' >&2`);
  release(500, {});
});
afterEach(() => {
  process.env.PATH = PATH;
  globalThis.fetch = FETCH;
});

test('reads the configuration with the installed skill', async () => {
  skillAt(path.join(root, '.agents/podarcis/lib'));
  const { state, log } = await runVault('uv', '.agents/podarcis/lib', root);
  assert.deepEqual(state, STATE);
  assert.equal(log, 'setup log');
  const script = path.join(root, '.agents/podarcis/lib/scripts/podarcis.py');
  assert.equal(readFileSync(path.join(root, 'uv.args'), 'utf8').trim(), `run --quiet ${script} --root ${root} config`);
  assert.deepEqual(requested, []);
});

test('applies a configuration through setup --stdin', async () => {
  const config = { repos: { sources: null, wiki: null, workspace: null }, mcp: [], skills: [] };
  await runVault('uv', skillAt(mkdtempSync(path.join(tmpdir(), 'podarcis-skill-'))), root, config);
  assert.match(readFileSync(path.join(root, 'uv.args'), 'utf8'), /setup --stdin$/m);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, 'uv.stdin'), 'utf8')), config);
});

test('runs the latest release from GitHub when the skill is missing', async () => {
  release(200, { tag_name: 'v2.1.0' });
  const { state, log } = await runVault('uv', '.agents/podarcis/lib', root);
  assert.deepEqual(state, STATE);
  assert.equal(log, 'Installed Podarcis v2.1.0.\nsetup log');
  assert.deepEqual(requested, ['https://api.github.com/repos/XicuM/podarcis-skill/releases/latest']);
  assert.equal(readFileSync(path.join(root, 'uv.args'), 'utf8').trim(),
    `run --quiet https://raw.githubusercontent.com/XicuM/podarcis-skill/v2.1.0/skills/podarcis/scripts/podarcis.py --root ${root} config`);
});

test('adds what PodarcisNest says about the workspace', async () => {
  skillAt(path.join(root, '.agents/podarcis/lib'));
  mkdirSync(path.join(root, '.agents/podarcis'), { recursive: true });
  writeFileSync(path.join(root, '.agents/podarcis/nest.json'), JSON.stringify({ sources_mode: 'team', locked: true, account_url: 'https://nest.example/account', extra: 1 }));
  const { state } = await runVault('uv', '.agents/podarcis/lib', root);
  assert.deepEqual(state.nest, { sources_mode: 'team', locked: true, account_url: 'https://nest.example/account' });
  writeFileSync(path.join(root, '.agents/podarcis/nest.json'), 'not json');
  assert.equal((await runVault('uv', '.agents/podarcis/lib', root)).state.nest, undefined);
});

test('moves a setting that names the 2.2 skill to the new install', async () => {
  skillAt(path.join(root, '.agents/skills/podarcis'));
  release(200, { tag_name: 'v2.3.0' });
  const { log } = await runVault('uv', '.agents/skills/podarcis', root);
  assert.equal(log, 'Installed Podarcis v2.3.0.\nsetup log');
  skillAt(path.join(root, '.agents/podarcis/lib'));
  await runVault('uv', '.agents/skills/podarcis/', root);
  const script = path.join(root, '.agents/podarcis/lib/scripts/podarcis.py');
  assert.equal(readFileSync(path.join(root, 'uv.args'), 'utf8').trim(), `run --quiet ${script} --root ${root} config`);
});

test('reports a failed release lookup without running uv', async () => {
  release(403, { message: 'rate limited' });
  await assert.rejects(runVault('uv', '.agents/podarcis/lib', root), /latest XicuM\/podarcis-skill release: HTTP 403/);
  assert.throws(() => readFileSync(path.join(root, 'uv.args')));
});

test('reports the script error', async () => {
  fake('uv', 'cat > /dev/null; echo "ValueError: repos takes only sources" >&2; exit 1');
  await assert.rejects(runVault('uv', skillAt(path.join(root, 's')), root), /repos takes only sources/);
});

test('reports a missing uv', async () => {
  const skill = skillAt(mkdtempSync(path.join(tmpdir(), 'podarcis-skill-')));
  await assert.rejects(runVault('/nonexistent/uv', skill, root), /Could not start \/nonexistent\/uv/);
});
