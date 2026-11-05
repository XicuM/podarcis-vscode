# Podarcis for VS Code

A sidebar to configure a [Podarcis](https://github.com/XicuM/podarcis-skill) research vault: the Git repositories for `sources/`, `wiki/`, and `workspace/`, the agents to set up, and MCP servers. **Apply** saves `podarcis.yaml` and runs the skill's setup, which clones the repositories and configures every agent.

In a folder without the skill, the sidebar runs the latest podarcis-skill release from GitHub, which installs it into `.agents/skills/podarcis`.

## Requirements

[uv](https://docs.astral.sh/uv/), plus git to sync folders with Git repositories, with network access on first use. If VS Code can't find uv, set `podarcis.uvCommand` to its absolute path.

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
