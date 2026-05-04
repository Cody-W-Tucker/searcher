# NixOS module for Vane service
{ pkgs }:

{ config, lib, ... }:

let
  cfg = config.services.vane;

  vane = pkgs.callPackage ./package.nix { };

  providerSecretValues = lib.filterAttrs (_: value: value != null) {
    EXA_API_KEY = cfg.exaApiKey;
    OPENAI_API_KEY = cfg.openaiApiKey;
  };

  mkCredentialId = envName:
    "env-"
    + lib.toLower (lib.replaceStrings [ "_" ] [ "-" ] envName);

  loadCredentials = lib.mapAttrsToList (envName: file:
    "${mkCredentialId envName}:${toString file}"
  ) providerSecretValues;

  credentialExports = lib.mapAttrsToList (envName: _:
    let
      credentialId = mkCredentialId envName;
    in
    ''
      if [ -r "''${CREDENTIALS_DIRECTORY}/${credentialId}" ]; then
        export ${envName}="$(tr -d '\r\n' < "''${CREDENTIALS_DIRECTORY}/${credentialId}")"
      fi
    ''
  ) providerSecretValues;
in
{
  options.services.vane = {
    enable = lib.mkEnableOption "Vane AI search interface";

    port = lib.mkOption {
      type = lib.types.port;
      default = 4110;
      description = "Port to listen on";
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/vane";
      description = "Directory for persistent data";
    };

    exaApiKey = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/exa-api-key";
      description = ''
        Path to a file containing the Exa API key.
        The file should contain only the key (no newlines).
        
        This is useful for secret management tools like sops-nix or agenix.
      '';
    };

    openaiEndpoint = lib.mkOption {
      type = lib.types.str;
      default = "https://api.openai.com/v1";
      description = "OpenAI-compatible API endpoint used by Vane.";
    };

    chatModels = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [];
      example = [ "gpt-4.1" "gpt-4.1-mini" ];
      description = ''
        Chat model IDs exposed through the OpenAI provider.

        This is mainly useful for OpenAI-compatible endpoints that do not expose
        a built-in model catalog to Vane.
      '';
    };

    embeddingModels = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [];
      example = [ "text-embedding-3-large" ];
      description = ''
        Embedding model IDs exposed through the OpenAI provider.
      '';
    };

    openaiApiKey = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/openai-api-key";
      description = ''
        Path to a file containing the OpenAI API key.
        The file should contain only the key (no newlines).
        
        This is useful for secret management tools like sops-nix or agenix.
      '';
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = {};
      description = "Additional environment variables";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = !(cfg.environment ? EXA_API_KEY);
        message = "Use services.vane.exaApiKey for the Exa secret instead of services.vane.environment.EXA_API_KEY.";
      }
      {
        assertion = !(cfg.environment ? OPENAI_API_KEY);
        message = "Use services.vane.openaiApiKey for the OpenAI secret instead of services.vane.environment.OPENAI_API_KEY.";
      }
    ];

    systemd.services.vane = {
      description = "Vane AI Search Interface";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        Type = "simple";
        User = "vane";
        Group = "vane";
        WorkingDirectory = cfg.dataDir;
        Restart = "always";
        RestartSec = 10;

        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadWritePaths = [ cfg.dataDir ];

        LoadCredential = loadCredentials;
      } // (lib.optionalAttrs (providerSecretValues == {}) {
        # Only use ExecStart when NOT using credential files
        ExecStart = "${vane}/bin/vane";
      });

      environment = {
        NODE_ENV = "production";
        PORT = toString cfg.port;
        DATA_DIR = cfg.dataDir;
        OPENAI_BASE_URL = cfg.openaiEndpoint;
      } // (lib.optionalAttrs (cfg.chatModels != []) {
          OPENAI_CHAT_MODELS = lib.concatStringsSep "," cfg.chatModels;
        })
        // (lib.optionalAttrs (cfg.embeddingModels != []) {
          OPENAI_EMBEDDING_MODELS = lib.concatStringsSep "," cfg.embeddingModels;
        })
        // cfg.environment;

      script = lib.mkIf (providerSecretValues != {}) (lib.concatStringsSep "\n" ([
        "# Load credentials from systemd credentials directory"
      ] ++ credentialExports ++ [
        "exec ${vane}/bin/vane"
      ]));
    };

    users.users.vane = {
      isSystemUser = true;
      group = "vane";
      home = cfg.dataDir;
      createHome = true;
      description = "Vane AI Search Service";
    };

    users.groups.vane = {};
  };
}
