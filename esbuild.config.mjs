import { copyFile, mkdir } from 'node:fs/promises';
import esbuild from 'esbuild';

const common = { bundle: true, target: 'es2021', logLevel: 'info' };
await mkdir('dist', { recursive: true });
await Promise.all([
  esbuild.build({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js', format: 'cjs', platform: 'node', external: ['vscode'] }),
  esbuild.build({ ...common, entryPoints: ['src/webview.ts'], outfile: 'dist/webview.js', format: 'iife', platform: 'browser' }),
  copyFile('webview.css', 'dist/webview.css'),
]);
