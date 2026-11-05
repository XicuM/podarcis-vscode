import { renderForm, State } from './form';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const vscode = acquireVsCodeApi();
let state: State | undefined;

window.addEventListener('message', (event: MessageEvent<{ state?: State; message?: string; error?: string }>) => {
  state = event.data.state ?? state;
  const message = event.data.error ?? event.data.message ?? '';
  if (!state) {
    document.body.replaceChildren();
    const pre = document.createElement('pre');
    pre.className = 'podarcis-message';
    pre.textContent = `${message}\n\nCheck podarcis.uvCommand and podarcis.skillPath in Settings. The panel installs the skill on first use, which needs Node.js (npx) and network access.`;
    const retry = document.createElement('button');
    retry.textContent = 'Retry';
    retry.onclick = () => vscode.postMessage({});
    document.body.append(pre, retry);
    return;
  }
  renderForm(document.body, state, message, {
    apply: (config) => vscode.postMessage({ config }),
    reload: () => vscode.postMessage({}),
  });
});

vscode.postMessage({});
