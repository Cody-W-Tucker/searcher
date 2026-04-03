{
  description = "Vane - A Nix-flake-based Next.js application with Yarn";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    {
      nixosModules = {
        default =
          args@{
            config,
            lib,
            pkgs,
            ...
          }:
          let
            yarnOfflineCache =
              (import ./nix/yarn.nix {
                inherit (pkgs)
                  fetchurl
                  fetchgit
                  linkFarm
                  runCommand
                  gnutar
                  ;
              }).offline_cache;
            module = import ./nix/module.nix { inherit pkgs yarnOfflineCache; };
          in
          module { inherit config lib pkgs; };
        vane =
          args@{
            config,
            lib,
            pkgs,
            ...
          }:
          let
            yarnOfflineCache =
              (import ./nix/yarn.nix {
                inherit (pkgs)
                  fetchurl
                  fetchgit
                  linkFarm
                  runCommand
                  gnutar
                  ;
              }).offline_cache;
            module = import ./nix/module.nix { inherit pkgs yarnOfflineCache; };
          in
          module { inherit config lib pkgs; };
      };
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        yarnOfflineCache =
          (import ./nix/yarn.nix {
            inherit (pkgs)
              fetchurl
              fetchgit
              linkFarm
              runCommand
              gnutar
              ;
          }).offline_cache;

        vane = pkgs.callPackage ./nix/package.nix {
          inherit yarnOfflineCache;
        };
      in
      {
        packages = {
          default = vane;
          inherit vane;
        };

        apps = {
          default = {
            type = "app";
            program = "${vane}/bin/vane";
          };
          regenerate-yarn-nix = {
            type = "app";
            program = "${pkgs.writeShellScriptBin "regenerate-yarn-nix" ''
              set -e
              echo "Regenerating nix/yarn.nix from yarn.lock..."
              ${pkgs.yarn2nix}/bin/yarn2nix --lockfile yarn.lock > nix/yarn.nix
              echo "Successfully regenerated nix/yarn.nix"
              echo ""
              echo "Don't forget to commit nix/yarn.nix along with yarn.lock changes!"
            ''}/bin/regenerate-yarn-nix";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            yarn
            node-gyp
            python3
            gcc
            gnumake
            sqlite
            vips
            pkg-config
          ];

          shellHook = ''
            echo "Vane development environment"
            echo "Node version: $(node --version)"
            echo "Yarn version: $(yarn --version)"

            export npm_config_build_from_source=true

            # Load .env.local if it exists
            [ -f .env.local ] && set -a && source .env.local && set +a

            # Default models if not set in .env.local
            export OPENAI_BASE_URL="https://opencode.ai/zen/v1"
            export OPENAI_CHAT_MODELS="''${OPENAI_CHAT_MODELS:-kimi-k2.5}"
            export OPENAI_EMBEDDING_MODELS="''${OPENAI_EMBEDDING_MODELS:-text-embedding-3-small}"

            if [ -d node_modules/better-sqlite3 ]; then
              if ! node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close()" >/dev/null 2>&1; then
                echo "Rebuilding better-sqlite3 for the current Node.js..."
                npm rebuild better-sqlite3 >/dev/null && echo "better-sqlite3 ready"
              fi
            fi
          '';
        };
      }
    );
}
