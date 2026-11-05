# Podarcis for VS Code

A sidebar to configure a [Podarcis](https://github.com/XicuM/podarcis-skill) research vault: the Git repositories for `sources/`, `wiki/`, and `workspace/`, the agents to set up, and MCP servers. **Apply** saves `podarcis.yaml` and runs the skill's setup, which clones the repositories and configures every agent through [dotagents](https://dotagents.sentry.dev/).

In a folder without the skill, the sidebar first installs the latest podarcis-skill release into `.agents/skills/podarcis`.

## Requirements

git, [uv](https://docs.astral.sh/uv/), and Node.js 22+, with network access on first use. If VS Code can't find uv, set `podarcis.uvCommand` to its absolute path.

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
