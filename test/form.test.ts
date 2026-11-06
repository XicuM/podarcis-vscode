import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextConfig } from '../src/form.ts';

const config = {
  repos: { sources: 'git@host:s.git', wiki: null, workspace: null },
  mcp: ['semantic-scholar', { name: 'remote', url: 'https://example.org/mcp', headers: { 'X-Key': 'v' } }],
  skills: [{ name: 'extra', source: 'owner/repo' }],
};

test('form choices become the configuration, with credentials only when typed', () => {
  assert.deepEqual(nextConfig(config, {
    repos: { sources: '', wiki: ' git@host:w.git ', workspace: '' },
    recommended: ['overleaf-suggest'],
    custom: [
      { name: 'remote', target: 'https://example.org/v2' },
      { name: ' local ', target: ' uvx  my-server --flag ' },
      { name: '', target: '' },
    ],
    skills: [{ name: 'extra', source: 'owner/repo', ref: ' v1 ', path: '' }, { name: '', source: '', ref: '', path: '' }],
    env: { SEMANTIC_SCHOLAR_API_KEY: ' key ', OTHER_KEY: '' },
  }), {
    repos: { sources: null, wiki: 'git@host:w.git', workspace: null },
    mcp: [
      'overleaf-suggest',
      { name: 'remote', url: 'https://example.org/v2', headers: { 'X-Key': 'v' } },
      { name: 'local', command: 'uvx', args: ['my-server', '--flag'] },
    ],
    skills: [{ name: 'extra', source: 'owner/repo', ref: 'v1' }],
    env: { SEMANTIC_SCHOLAR_API_KEY: 'key' },
  });
});

test('no typed credentials leaves env out', () => {
  const next = nextConfig(config, { repos: {}, recommended: [], custom: [], skills: [], env: { A: ' ' } });
  assert.equal('env' in next, false);
});
