#!/bin/bash
set -euo pipefail

# Build a universal macOS wget binary for bundling with Yoinkit
# Requires: Xcode command line tools, autoconf, automake

WGET_VERSION="1.24.5"
WGET_URL="https://ftp.gnu.org/gnu/wget/wget-${WGET_VERSION}.tar.gz"
BUILD_DIR="$(mktemp -d)"
OUTPUT_DIR="$(cd "$(dirname "$0")/../apps/desktop/src-tauri/bin" && pwd)"

echo "=== Yoinkit Wget Builder ==="
echo "Building wget ${WGET_VERSION} for macOS (universal binary)"
echo "Build dir: ${BUILD_DIR}"
echo "Output dir: ${OUTPUT_DIR}"

# Download wget source
echo ""
echo ">>> Downloading wget ${WGET_VERSION}..."
cd "${BUILD_DIR}"
curl -L -o wget.tar.gz "${WGET_URL}"
tar xzf wget.tar.gz
cd "wget-${WGET_VERSION}"

# Build for arm64
echo ""
echo ">>> Building for arm64..."
mkdir -p build-arm64
cd build-arm64
../configure \
  --with-ssl=openssl \
  --without-libpsl \
  --disable-nls \
  --disable-dependency-tracking \
  CFLAGS="-arch arm64 -mmacosx-version-min=11.0" \
  LDFLAGS="-arch arm64" \
  --host=aarch64-apple-darwin \
  --prefix="${BUILD_DIR}/install-arm64"
make -j$(sysctl -n hw.ncpu)
make install
cd ..

# Build for x86_64
echo ""
echo ">>> Building for x86_64..."
mkdir -p build-x86_64
cd build-x86_64
../configure \
  --with-ssl=openssl \
  --without-libpsl \
  --disable-nls \
  --disable-dependency-tracking \
  CFLAGS="-arch x86_64 -mmacosx-version-min=11.0" \
  LDFLAGS="-arch x86_64" \
  --host=x86_64-apple-darwin \
  --prefix="${BUILD_DIR}/install-x86_64"
make -j$(sysctl -n hw.ncpu)
make install
cd ..

# Create universal binary
echo ""
echo ">>> Creating universal binary..."
mkdir -p "${OUTPUT_DIR}"
lipo -create \
  "${BUILD_DIR}/install-arm64/bin/wget" \
  "${BUILD_DIR}/install-x86_64/bin/wget" \
  -output "${OUTPUT_DIR}/wget"

chmod +x "${OUTPUT_DIR}/wget"

# Verify
echo ""
echo ">>> Verifying..."
file "${OUTPUT_DIR}/wget"
"${OUTPUT_DIR}/wget" --version | head -1

# Cleanup
echo ""
echo ">>> Cleaning up build directory..."
rm -rf "${BUILD_DIR}"

echo ""
echo "=== Done! wget binary at: ${OUTPUT_DIR}/wget ==="
