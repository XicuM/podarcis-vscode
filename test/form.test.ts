import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextConfig } from '../src/form.ts';

const config = {
  agents: ['claude'],
  repos: { sources: 'git@host:s.git', wiki: null, workspace: null },
  mcp: ['semantic-scholar', { name: 'remote', url: 'https://example.org/mcp', headers: { 'X-Key': 'v' } }],
  skills: [{ name: 'extra', source: 'owner/repo' }],
};

test('form choices become the configuration, with credentials only when typed', () => {
  assert.deepEqual(nextConfig(config, {
    repos: { sources: '', wiki: ' git@host:w.git ', workspace: '' },
    agents: ['claude', 'vscode'],
    recommended: ['google-drive'],
    custom: [
      { name: 'remote', target: 'https://example.org/v2' },
      { name: ' local ', target: ' uvx  my-server --flag ' },
      { name: '', target: '' },
    ],
    skills: [{ name: 'extra', source: 'owner/repo', ref: ' v1 ', path: '' }, { name: '', source: '', ref: '', path: '' }],
    env: { GOOGLE_OAUTH_CLIENT_ID: ' id ', GOOGLE_OAUTH_CLIENT_SECRET: '' },
  }), {
    agents: ['claude', 'vscode'],
    repos: { sources: null, wiki: 'git@host:w.git', workspace: null },
    mcp: [
      'google-drive',
      { name: 'remote', url: 'https://example.org/v2', headers: { 'X-Key': 'v' } },
      { name: 'local', command: 'uvx', args: ['my-server', '--flag'] },
    ],
    skills: [{ name: 'extra', source: 'owner/repo', ref: 'v1' }],
    env: { GOOGLE_OAUTH_CLIENT_ID: 'id' },
  });
});

test('no typed credentials leaves env out', () => {
  const next = nextConfig(config, { repos: {}, agents: [], recommended: [], custom: [], skills: [], env: { A: ' ' } });
  assert.equal('env' in next, false);
});
