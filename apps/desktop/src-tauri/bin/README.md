# Bundled Wget Binary

This directory should contain the wget binary that gets bundled with the Yoinkit app.

## For development

If you have wget installed via Homebrew, Yoinkit will fall back to the system wget.
For full testing, place a wget binary here.

## For production builds

Run the build script to download and compile a universal macOS wget binary:

```bash
cd scripts && ./build-wget.sh
```

This produces a universal (arm64 + x86_64) static binary at `apps/desktop/src-tauri/bin/wget`.
