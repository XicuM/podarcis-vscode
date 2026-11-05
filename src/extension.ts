import * as vscode from 'vscode';
import type { Config } from './form';
import { runVault } from './run';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('podarcis.setup', { resolveWebviewView: (view) => show(context, view) }),
  );
}

function show(context: vscode.ExtensionContext, view: vscode.WebviewView) {
  const dist = vscode.Uri.joinPath(context.extensionUri, 'dist');
  const { webview } = view;
  webview.options = { enableScripts: true, localResourceRoots: [dist] };
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16)).join('');
  webview.html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.css'))}">
</head><body><p>Loading Podarcis configuration…</p>
<script nonce="${nonce}" src="${webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'))}"></script>
</body></html>`;
  // The webview can only ask to read the configuration, apply a new one, or update the skill.
  webview.onDidReceiveMessage(async (message: { config?: Config; update?: boolean }) => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return webview.postMessage({ error: 'Open a vault folder to set up Podarcis.' });
    const settings = vscode.workspace.getConfiguration('podarcis');
    try {
      const { state, log } = await runVault(
        settings.get('uvCommand', 'uv'), settings.get('skillPath', '.agents/skills/podarcis'), root, message.config, message.update,
      );
      webview.postMessage({ state, message: log });
    } catch (error) {
      webview.postMessage({ error: (error as Error).message });
    }
  });
}
