# Podarcis for VS Code

A sidebar to configure a [Podarcis](https://github.com/XicuM/podarcis-skill) research vault: the Git repositories for `sources/`, `wiki/`, and `workspace/`, recommended and custom MCP servers with their credentials, and extra skills. **Apply** saves `.agents/podarcis/config.yaml` (repositories), `.agents/podarcis/tools.yaml` (servers and skills), and `.agents/podarcis/.env` (credentials), then runs the skill's setup, which clones the repositories and gives the tools to every agent: Claude Code, Codex, OpenCode, and VS Code. **Update** installs the latest podarcis-skill release.

In a folder without the skill, the sidebar runs the latest podarcis-skill release from GitHub, which installs it into `.agents/skills/podarcis`.

## Requirements

[uv](https://docs.astral.sh/uv/), plus git to sync folders with Git repositories, with network access on first use. If VS Code can't find uv, set `podarcis.uvCommand` to its absolute path.

To also ask for model API keys, list their names in `podarcis.apiKeys`, e.g. `["GEPETO_API_KEY"]`. The sidebar saves them to `.agents/podarcis/.env` with the other credentials.

## Install

Download `podarcis.vsix` from the [latest release](https://github.com/XicuM/podarcis-vscode/releases/latest), then:

```bash
code --install-extension podarcis.vsix
```

## Development

```bash
npm ci && npm test && npm run build && npm run package
```

Releases: set `version` in `package.json`, then push the tag `v<version>`.

[AGPL-3.0](LICENSE)
