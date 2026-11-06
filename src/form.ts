export type Mcp = string | Record<string, unknown>;
export interface Config {
  repos: Record<string, string | null>;
  mcp: Mcp[];
  skills: Record<string, unknown>[];
  env?: Record<string, string>;
}
export interface Server { description: string; setup?: string; env?: string[] }
export interface Repo { state: 'missing' | 'local' | 'repo'; url: string | null; empty?: boolean }
export interface State {
  version?: string;
  config: Config;
  catalogue: Record<string, Server>;
  repos: Record<string, Repo>;
  env?: string[];
  actions?: Record<string, string>;
}
export interface Choices {
  repos: Record<string, string>;
  recommended: string[];
  custom: { name: string; target: string }[];
  skills: Record<string, string>[];
  env: Record<string, string>;
}

export const REPOS = ['sources', 'wiki', 'workspace'];
const SKILL_FIELDS = ['name', 'source', 'ref', 'path'];

/**
 * Turn the form's choices into the configuration for setup. A custom server's target is a URL or a
 * command line split on spaces; headers stay from the configuration. Empty rows and credentials are dropped.
 */
export function nextConfig(config: Config, choices: Choices): Config {
  const custom = choices.custom.filter((c) => c.name.trim() || c.target.trim()).map(({ name, target }) => {
    const old = config.mcp.find((m) => typeof m !== 'string' && m.name === name.trim()) as Record<string, unknown> | undefined;
    if (/^https?:\/\//.test(target.trim())) {
      return { name: name.trim(), url: target.trim(), ...(old?.headers ? { headers: old.headers } : {}) };
    }
    const [command = '', ...args] = target.trim().split(/\s+/);
    return { name: name.trim(), command, args };
  });
  const skills = choices.skills.filter((s) => SKILL_FIELDS.some((f) => s[f]?.trim())).map((s) =>
    Object.fromEntries(SKILL_FIELDS.filter((f) => s[f]?.trim()).map((f) => [f, s[f].trim()])));
  const env = Object.fromEntries(Object.entries(choices.env).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
  return {
    repos: Object.fromEntries(REPOS.map((r) => [r, choices.repos[r]?.trim() || null])),
    mcp: [...choices.recommended, ...custom],
    skills,
    ...(Object.keys(env).length ? { env } : {}),
  };
}

/**
 * Render the setup form as plain DOM, shared by the Obsidian view and the VS Code webview.
 * `keys` names extra credentials, such as model API keys, to ask for besides the MCP servers' ones.
 */
export function renderForm(
  el: HTMLElement, state: State, message: string,
  actions: { apply: (config: Config) => void; reload: () => void; update: () => void },
  keys: string[] = [],
): void {
  const doc = el.ownerDocument;
  const add = <K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement, tag: K, text?: string, cls?: string,
  ): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    parent.appendChild(node);
    return node;
  };
  const input = (parent: HTMLElement, value: string, placeholder: string, type = 'text') => {
    const box = add(parent, 'input');
    box.type = type;
    box.value = value;
    box.placeholder = placeholder;
    return box;
  };
  const check = (parent: HTMLElement, label: string, checked: boolean) => {
    const row = add(parent, 'label', undefined, 'podarcis-check');
    const box = add(row, 'input');
    box.type = 'checkbox';
    box.checked = checked;
    add(row, 'span', label);
    return box;
  };
  /** A list of removable rows of text boxes, with a button to add an empty row. */
  const rows = (fields: string[], values: string[][], label: string) => {
    const list = add(el, 'div');
    const all: HTMLInputElement[][] = [];
    const row = (value: string[]) => {
      const line = add(list, 'div', undefined, 'podarcis-row');
      const boxes = fields.map((f, i) => input(line, value[i] ?? '', f));
      add(line, 'button', '✕').onclick = () => {
        line.remove();
        all.splice(all.indexOf(boxes), 1);
      };
      all.push(boxes);
    };
    values.forEach(row);
    add(el, 'button', label, 'podarcis-add').onclick = () => row([]);
    return () => all.map((boxes) => boxes.map((b) => b.value));
  };
  el.replaceChildren();
  el.classList.add('podarcis-panel');
  if (message) add(el, 'pre', message, 'podarcis-message');

  add(el, 'h4', 'Repositories');
  const urls: Record<string, HTMLInputElement> = {};
  for (const name of REPOS) {
    const repo = state.repos[name];
    const row = add(el, 'div', undefined, 'podarcis-repo');
    add(row, 'span', `${name}/`, 'podarcis-name');
    const detail = repo.state === 'repo' ? `clone of ${repo.url ?? 'no remote'}` : repo.state === 'local' ? 'local folder' : 'not created';
    add(row, 'span', state.actions?.[name] ? `${detail} · ${state.actions[name]}` : detail, 'podarcis-muted');
    urls[name] = input(row, state.config.repos[name] ?? '', 'Git URL, or empty for a local folder');
  }

  const env: Record<string, HTMLInputElement> = {};
  // Values are never shown; an empty box keeps the stored one.
  const secret = (key: string) =>
    (env[key] = input(el, '', state.env?.includes(key) ? `${key} (set; type to replace)` : key, 'password'));
  if (keys.length) {
    add(el, 'h4', 'API keys');
    keys.forEach(secret);
  }

  add(el, 'h4', 'Recommended MCP servers');
  const servers = Object.entries(state.catalogue).map(([name, server]) => {
    const box = check(el, name, state.config.mcp.includes(name));
    add(el, 'div', server.description, 'podarcis-muted');
    if (server.setup) add(el, 'div', server.setup, 'podarcis-muted podarcis-setup');
    for (const key of server.env ?? []) if (!keys.includes(key)) secret(key);
    return [name, box] as const;
  });

  add(el, 'h4', 'Custom MCP servers');
  const custom = rows(['name', 'command line or URL'], state.config.mcp.filter((m) => typeof m !== 'string').map((m) => [
    String(m.name), m.url ? String(m.url) : [m.command, ...((m.args as string[]) ?? [])].join(' '),
  ]), 'Add server');

  add(el, 'h4', 'Extra skills');
  const skills = rows(SKILL_FIELDS.map((f) => (f === 'source' ? 'owner/repo or git:<url>' : f)),
    state.config.skills.map((s) => SKILL_FIELDS.map((f) => String(s[f] ?? ''))), 'Add skill');

  const buttons = add(el, 'div', undefined, 'podarcis-buttons');
  const apply = add(buttons, 'button', 'Apply', 'mod-cta');
  const reload = add(buttons, 'button', 'Reload');
  const update = add(buttons, 'button', 'Update');
  add(el, 'div', `Podarcis ${state.version ?? '2.0.0 or older'}. Update installs the latest release.`, 'podarcis-muted');
  const busy = (button: HTMLButtonElement, text: string) => {
    apply.disabled = reload.disabled = update.disabled = true;
    button.textContent = text;
  };
  apply.onclick = () => {
    busy(apply, 'Applying…');
    actions.apply(nextConfig(state.config, {
      repos: Object.fromEntries(REPOS.map((r) => [r, urls[r].value])),
      recommended: servers.filter(([, b]) => b.checked).map(([n]) => n),
      custom: custom().map(([name, target]) => ({ name, target })),
      skills: skills().map((values) => Object.fromEntries(SKILL_FIELDS.map((f, i) => [f, values[i]]))),
      env: Object.fromEntries(Object.entries(env).map(([k, box]) => [k, box.value])),
    }));
  };
  reload.onclick = actions.reload;
  update.onclick = () => {
    busy(update, 'Updating…');
    actions.update();
  };
}
