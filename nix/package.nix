# The main Vane application package
{ pkgs }:

pkgs.stdenv.mkDerivation rec {
  pname = "vane";
  version = (pkgs.lib.importJSON ./../package.json).version;

  src = ./..;

  offlineCache = pkgs.fetchYarnDeps {
    yarnLock = ./../yarn.lock;
    hash = "sha256-niC1feeXsClR/BRN30T/3ywVzm3fJh1AVBVHvGbVJN8=";
  };

  dontFixup = true;
  doDist = false;

  nativeBuildInputs = with pkgs; [
    yarnConfigHook
    python3
    nodejs_24
    gcc
    gnumake
  ];

  buildInputs = with pkgs; [
    sqlite
    nodejs_24
  ];

  npm_config_build_from_source = "true";
  npm_config_sqlite = "${pkgs.sqlite}";

  NODE_ENV = "production";
  NEXT_TELEMETRY_DISABLED = "1";
  npm_config_nodedir = "${pkgs.nodejs_24}";
  NEXT_PRIVATE_SKIP_PRERENDER_ERRORS = "1";

  buildPhase = ''
    export HOME=$(mktemp -d)

    if [ -d node_modules/better-sqlite3 ]; then
      pushd node_modules/better-sqlite3
      ${pkgs.nodejs_24}/bin/npm run build-release || ${pkgs.nodejs_24}/bin/npx node-gyp rebuild
      popd
    fi

    if [ -d deps/vane/node_modules/better-sqlite3 ]; then
      pushd deps/vane/node_modules/better-sqlite3
      ${pkgs.nodejs_24}/bin/npm run build-release || ${pkgs.nodejs_24}/bin/npx node-gyp rebuild
      popd
    fi

    yarn build
  '';

  installPhase = ''
    mkdir -p $out/lib/vane

    if [ -d deps/vane/.next/standalone ]; then
      cp -r deps/vane/.next/standalone/. $out/lib/vane/
    elif [ -d .next/standalone ]; then
      cp -r .next/standalone/. $out/lib/vane/
    else
      echo "Warning: standalone directory not found"
      ls -la .next/ 2>/dev/null || echo "No .next directory"
      ls -la deps/vane/.next/ 2>/dev/null || echo "No deps/vane/.next directory"
    fi

    if [ -L $out/lib/vane/node_modules ]; then
      nodeModulesTarget=$(readlink -f $out/lib/vane/node_modules)
      modulesRoot=''${nodeModulesTarget%/deps/vane/node_modules}

      if [ "$modulesRoot" != "$nodeModulesTarget" ] && [ -e "$modulesRoot/node_modules/next/package.json" ]; then
        rm $out/lib/vane/node_modules
        mkdir -p $out/lib/vane/node_modules

        for entry in "$modulesRoot/node_modules"/* "$modulesRoot/node_modules"/.*; do
          name=$(basename "$entry")

          if [ "$name" = "." ] || [ "$name" = ".." ] || [ "$name" = "better-sqlite3" ]; then
            continue
          fi

          ln -s "$entry" "$out/lib/vane/node_modules/$name"
        done
      fi
    fi

    for nativeModulesPath in deps/vane/node_modules node_modules; do
      if [ -d "$nativeModulesPath/better-sqlite3" ]; then
        cp -r "$nativeModulesPath/better-sqlite3" $out/lib/vane/node_modules/
        break
      fi
    done

    mkdir -p $out/lib/vane/public/_next/static
    if [ -d deps/vane/.next/static ]; then
      cp -r deps/vane/.next/static/* $out/lib/vane/public/_next/static/ 2>/dev/null || true
    elif [ -d .next/static ]; then
      cp -r .next/static/* $out/lib/vane/public/_next/static/ 2>/dev/null || true
    fi

    if [ -d deps/vane/public ]; then
      cp -r deps/vane/public/* $out/lib/vane/public/ 2>/dev/null || true
    elif [ -d public ]; then
      cp -r public/* $out/lib/vane/public/ 2>/dev/null || true
    fi

    if [ -d deps/vane/drizzle ]; then
      cp -r deps/vane/drizzle $out/lib/vane/ 2>/dev/null || true
    elif [ -d drizzle ]; then
      cp -r drizzle $out/lib/vane/ 2>/dev/null || true
    fi

    mkdir -p $out/bin

    cat > $out/bin/vane <<'EOF'
    #!${pkgs.bash}/bin/bash
    set -e
    APP_DIR="OUT_PATH/lib/vane"
    export DATA_DIR="''${DATA_DIR:-$PWD}"
    export NEXT_TELEMETRY_DISABLED="''${NEXT_TELEMETRY_DISABLED:-1}"
    export NEXT_CACHE_DIR="''${NEXT_CACHE_DIR:-$DATA_DIR/.next/cache}"
    RUNTIME_APP_DIR="$DATA_DIR/app"
    RUNTIME_SOURCE_FILE="$RUNTIME_APP_DIR/.source-path"
    mkdir -p "$DATA_DIR/data/uploads"
    mkdir -p "$NEXT_CACHE_DIR"

    if [ ! -f "$RUNTIME_SOURCE_FILE" ] || [ "$(<"$RUNTIME_SOURCE_FILE")" != "$APP_DIR" ]; then
      rm -rf "$RUNTIME_APP_DIR"
      mkdir -p "$RUNTIME_APP_DIR"
      cp -r "$APP_DIR"/. "$RUNTIME_APP_DIR"/
      chmod -R u+w "$RUNTIME_APP_DIR"
      printf '%s\n' "$APP_DIR" > "$RUNTIME_SOURCE_FILE"
    fi

    if [ ! -d "$DATA_DIR/drizzle" ] && [ -d "$APP_DIR/drizzle" ]; then
      cp -r "$APP_DIR/drizzle" "$DATA_DIR/"
    fi
    exec NODEJS_PATH/bin/node "$RUNTIME_APP_DIR/server.js"
    EOF

    substituteInPlace $out/bin/vane \
      --replace "NODEJS_PATH" "${pkgs.nodejs_24}" \
      --replace "OUT_PATH" "$out"

    chmod +x $out/bin/vane
  '';

  meta = with pkgs.lib; {
    description = "Vane - AI-powered search interface";
    homepage = "https://github.com/ItzCrazyKns/Perplexica";
    license = licenses.mit;
    platforms = platforms.linux ++ platforms.darwin;
  };
}
