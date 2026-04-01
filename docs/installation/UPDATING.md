# Update Vane to the latest version

To update Vane to the latest version, follow these steps:

## Using Nix (Recommended)

Simply update your flake inputs and run:

```bash
nix flake update
cd /path/to/your/vane/flake
nix run .#
```

Or run directly from the repository:

```bash
nix run github:ItzCrazyKns/Vane
```

Your settings are preserved automatically.

## Manual Update

1. Navigate to your Vane directory and pull the latest changes:

   ```bash
   cd Vane
   git pull origin master
   ```

2. Install any new dependencies:

   ```bash
   npm i
   ```

3. Rebuild the application:

   ```bash
   npm run build
   ```

4. Restart the application:

   ```bash
   npm run start
   ```

5. Go to http://localhost:3000 and verify the latest changes. Your settings are preserved automatically.
