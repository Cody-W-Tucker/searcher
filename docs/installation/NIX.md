# Nix Installation Guide

This guide covers all Nix-based installation and deployment methods for Vane.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation Methods](#installation-methods)
  - [Method 1: Run from GitHub (Simplest)](#method-1-run-from-github-simplest)
  - [Method 2: Local Clone with Flake](#method-2-local-clone-with-flake)
  - [Method 3: NixOS Module (Production)](#method-3-nixos-module-production)
- [Development Environment](#development-environment)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Exa Search Configuration](#exa-search-configuration)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Run directly from GitHub (no clone needed)
nix run github:ItzCrazyKns/Vane
```

Then open http://localhost:3000

## Installation Methods

### Method 1: Run from GitHub (Simplest)

Perfect for trying out Vane without any local setup:

```bash
# Run latest version
nix run github:ItzCrazyKns/Vane

# Run specific version
nix run github:ItzCrazyKns/Vane/v1.2.3

# Run with Exa configured up front
EXA_API_KEY=your_exa_api_key nix run github:ItzCrazyKns/Vane
```

### Method 2: Local Clone with Flake

Best for development or when you want more control:

```bash
# Clone the repository
git clone https://github.com/ItzCrazyKns/Vane.git
cd Vane

# Run directly from local flake
nix run .#

# Or enter development shell
nix develop

# Inside dev shell, use standard npm/yarn commands
npm install
npm run dev
npm run build
```

**Benefits of local clone:**

- Modify source code
- Use development shell with all dependencies pre-installed
- Lock to specific version with `flake.lock`

### Method 3: NixOS Module (Production)

For NixOS systems, use the provided module for proper service management:

```nix
# In your NixOS configuration (configuration.nix or flake.nix)
{
  inputs.vane.url = "github:ItzCrazyKns/Vane";

  outputs = { self, nixpkgs, vane }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        vane.nixosModules.vane
        {
          services.vane = {
            enable = true;
            port = 3000;
            dataDir = "/var/lib/vane";
            exaApiKey = config.sops.secrets.exa-api-key.path;
            openaiApiKey = config.sops.secrets.openai-api-key.path;
            openaiEndpoint = "https://api.openai.com/v1";
            chatModels = [ "gpt-4.1" "gpt-4.1-mini" ];
            embeddingModels = [ "text-embedding-3-large" ];

            # Additional environment variables
            environment = {
              NEXT_TELEMETRY_DISABLED = "1";
            };
          };

        }
      ];
    };
  };
}
```

**NixOS Module Options:**

| Option            | Type            | Default                     | Description                                  |
| ----------------- | --------------- | --------------------------- | -------------------------------------------- |
| `enable`          | boolean         | `false`                     | Enable Vane service                          |
| `port`            | port            | `4110`                      | HTTP port to listen on                       |
| `dataDir`         | path            | `/var/lib/vane`             | Persistent data directory                    |
| `exaApiKey`       | null or path    | `null`                      | Path to a file containing the Exa API key    |
| `openaiApiKey`    | null or path    | `null`                      | Path to a file containing the OpenAI API key |
| `openaiEndpoint`  | string          | `https://api.openai.com/v1` | OpenAI-compatible endpoint                   |
| `chatModels`      | list of strings | `[]`                        | Chat model IDs exposed by the provider       |
| `embeddingModels` | list of strings | `[]`                        | Embedding model IDs exposed by provider      |
| `environment`     | attrs           | `{}`                        | Additional environment variables             |

Secret values for the NixOS module must come from files. The module reads them
through systemd credentials instead of embedding raw API keys in the unit environment.

**Service Management:**

```bash
# Check service status
sudo systemctl status vane

# View logs
sudo journalctl -u vane -f

# Restart service
sudo systemctl restart vane
```

## Development Environment

The flake provides a complete development shell:

```bash
# Enter development shell
nix develop

# Now you have access to:
# - Node.js 24
# - Yarn
# - Python 3 (for native module compilation)
# - GCC and build tools
# - SQLite

# Verify environment
echo "Node: $(node --version)"
echo "Yarn: $(yarn --version)"

# Install dependencies
yarn install

# Run in development mode
yarn dev

# Build for production
yarn build
```

**Using with direnv (optional):**

Create `.envrc` in project root:

```bash
use flake
```

Then:

```bash
# Allow direnv
direnv allow

# Now environment loads automatically when entering directory
```

## Configuration

### Environment Variables

All standard Vane environment variables work with Nix:

| Variable                  | Description                | Example                     |
| ------------------------- | -------------------------- | --------------------------- |
| `EXA_API_KEY`             | Exa API key                | `exa_...`                   |
| `OPENAI_API_KEY`          | OpenAI API key             | `sk-...`                    |
| `OPENAI_BASE_URL`         | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `OPENAI_CHAT_MODELS`      | OpenAI chat model IDs      | `gpt-4.1,gpt-4.1-mini`      |
| `OPENAI_EMBEDDING_MODELS` | OpenAI embedding model IDs | `text-embedding-3-large`    |
| `DATA_DIR`                | Data persistence directory | `/var/lib/vane`             |
| `PORT`                    | HTTP port                  | `3000`                      |

**Using with nix run:**

```bash
EXA_API_KEY=your_exa_api_key \
OLLAMA_BASE_URL=http://ollama:11434 \
nix run github:ItzCrazyKns/Vane
```

**Using with NixOS module:**

```nix
services.vane = {
  enable = true;
  exaApiKey = config.sops.secrets.exa-api-key.path;
  openaiApiKey = config.sops.secrets.openai-api-key.path;
  openaiEndpoint = "https://api.openai.com/v1";
  chatModels = [ "gpt-4.1" "gpt-4.1-mini" ];
  embeddingModels = [ "text-embedding-3-large" ];
  environment = {
    NEXT_TELEMETRY_DISABLED = "1";
  };
};
```

Vane picks up these values automatically at startup, so there is no setup flow for
NixOS deployments. Providers, endpoints, and model catalogs are managed declaratively.

### Exa Search Configuration

Use either of these approaches:

```bash
EXA_API_KEY=your_exa_api_key nix run github:ItzCrazyKns/Vane
```

```nix
services.vane = {
  enable = true;
  exaApiKey = config.sops.secrets.exa-api-key.path;
};
```

## Updating

### When Running from GitHub

```bash
# Force update to latest
nix run github:ItzCrazyKns/Vane --refresh

# Or update flake inputs if using locally
nix flake update
nix run .#
```

### When Using NixOS Module

```bash
# Update flake inputs
nix flake update

# Rebuild NixOS
sudo nixos-rebuild switch

# Or with flake:
sudo nixos-rebuild switch --flake .#
```

### Settings Persistence

Your settings are stored in the `DATA_DIR` directory (default: current working directory for `nix run`, `/var/lib/vane` for NixOS module). They persist across updates.

## Troubleshooting

### Build fails with "better-sqlite3" errors

The flake automatically rebuilds native modules. If you see errors:

```bash
# Clean and rebuild
rm -rf node_modules
nix run .# --rebuild

# Or in dev shell
nix develop
rm -rf node_modules
yarn install
npm rebuild better-sqlite3
```

### Permission denied errors

When using `nix run`, data is stored in current directory. Ensure you have write permissions:

```bash
# Use specific data directory
mkdir -p ~/vane-data
DATA_DIR=~/vane-data nix run github:ItzCrazyKns/Vane
```

### Port already in use

```bash
# Use different port
PORT=3001 nix run github:ItzCrazyKns/Vane
```

### Cannot connect to Ollama

If running Ollama locally, ensure it's accessible:

```bash
# Test Ollama connection
curl http://localhost:11434/api/tags

# If using Nix, ensure proper URL
OLLAMA_BASE_URL=http://localhost:11434 nix run github:ItzCrazyKns/Vane
```

**Note:** Ollama must be configured to accept external connections. See [Ollama documentation](https://github.com/ollama/ollama/blob/main/docs/faq.md) for configuration.

### Service fails to start (NixOS)

Check logs for details:

```bash
sudo journalctl -u vane -n 100 --no-pager
```

Common issues:

- Invalid or missing `EXA_API_KEY`
- Permission issues on `dataDir`
- Missing required environment variables

### Flake evaluation errors

```bash
# Update nixpkgs flake input
nix flake lock --update-input nixpkgs

# Check flake syntax
nix flake check

# Debug evaluation
nix eval .#packages.x86_64-linux.vane --show-trace
```

## Advanced Usage

### Custom Overrides

Override package inputs:

```nix
{
  inputs.vane.url = "github:ItzCrazyKns/Vane";

  outputs = { self, nixpkgs, vane }: {
    packages.x86_64-linux.vane-custom = vane.packages.x86_64-linux.vane.overrideAttrs (old: {
      # Custom build steps or patches
    });
  };
}
```

### Binary Cache (faster builds)

Add to your Nix configuration:

```nix
nix.settings = {
  substituters = [ "https://cache.nixos.org" ];
  trusted-public-keys = [ "cache.nixos.org-1:..." ];
};
```

### Integration with Home Manager

```nix
{ config, pkgs, ... }: {
  home.packages = [
    (builtins.getFlake "github:ItzCrazyKns/Vane").packages.x86_64-linux.vane
  ];

  # Or with local clone
  # home.packages = [ (builtins.getFlake "path:/home/user/Vane").packages.x86_64-linux.vane ];
}
```

---

For more information, see the [main installation guide](../README.md) or [architecture documentation](../architecture/README.md).
