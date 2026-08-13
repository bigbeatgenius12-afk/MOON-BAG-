# App Bundle Build Guide

## Quick Start

Build your app bundle:

```bash
pnpm build
```

This creates an optimized bundle in `artifacts/api-server/dist/index.mjs`

---

## Build Commands

### Basic Builds

**Development build** (fast, with source maps):
```bash
pnpm -C artifacts/api-server build
```

**Production build** (minified, optimized):
```bash
pnpm -C artifacts/api-server build:prod
```

**Staging build** (moderate optimization):
```bash
pnpm -C artifacts/api-server build:staging
```

### Format-Specific Builds

**ESM** (ECMAScript Module - modern, async-friendly):
```bash
pnpm -C artifacts/api-server build:esm
```
Output: `dist/index.mjs`

**CommonJS** (CJS - Node.js standard, sync-friendly):
```bash
pnpm -C artifacts/api-server build:cjs
```
Output: `dist/index.cjs`

**IIFE** (Browser-ready - Immediately Invoked Function Expression):
```bash
pnpm -C artifacts/api-server build:iife
```
Output: `dist/index.js`

**All formats** in one build:
```bash
pnpm -C artifacts/api-server build:all
```

### Optimization Builds

**Minified bundle** (reduced file size):
```bash
pnpm -C artifacts/api-server build:minified
```

**Compressed bundle** (gzip + brotli):
```bash
pnpm -C artifacts/api-server build:compressed
```

**Production-ready** (all optimizations):
```bash
pnpm -C artifacts/api-server build:prod:all
```

### Run the Bundle

**Start the server**:
```bash
pnpm -C artifacts/api-server start
```

**Development workflow** (auto-rebuild + start):
```bash
pnpm -C artifacts/api-server dev
```

---

## Environment Variables

Control the build process with environment variables:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `NODE_ENV` | `development`, `staging`, `production` | `development` | Build environment |
| `BUILD_FORMAT` | `esm`, `cjs`, `iife` | `esm` | Output format (comma-separated for multiple) |
| `MINIFY` | `true`, `false` | `false` | Minify output code |
| `COMPRESS` | `true`, `false` | `false` | Gzip compress output |
| `SOURCEMAP` | `linked`, `external`, `inline`, `none` | `linked` | Source map strategy |
| `LOG_LEVEL` | `info`, `warning`, `error` | `info` | Build log verbosity |
| `BUILD_ID` | any string | none | Build identifier |

### Examples

Production build with compression:
```bash
NODE_ENV=production COMPRESS=true MINIFY=true pnpm -C artifacts/api-server build
```

Multiple formats in one command:
```bash
BUILD_FORMAT=esm,cjs pnpm -C artifacts/api-server build
```

---

## Build Output

After building, you'll see output like:

```
🚀 Starting build process...
   Environment: production
   Minify: true
   Source maps: linked
   Compress: false

🧹 Cleaning output directory...
   ✓ Cleaned

📦 Building ESM format...
  ✓ Built successfully
    Size: 2.45 MB

📊 Build Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ ESM: 2.45 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result: 1/1 formats built successfully
```

### Generated Files

- **`dist/index.mjs`** - ESM bundle (main output)
- **`dist/index.mjs.map`** - ESM source map
- **`dist/index.cjs`** - CommonJS bundle (if built)
- **`dist/index.js.gz`** - Gzipped bundle (if compression enabled)

---

## Build Configuration

The build system is configured in:
- **`artifacts/api-server/build.mjs`** - Build script
- **`artifacts/api-server/build.config.mjs`** - Configuration options

### What Gets Bundled

✅ All dependencies (except externals)  
✅ Pino logging with pretty-printing  
✅ CommonJS/ESM compatibility shims  
✅ Source maps for debugging  

### What's Excluded (Externalized)

❌ Native modules (`.node` files)  
❌ Large optional dependencies (native compiles)  
❌ Cloud SDKs (@google-cloud/*, @aws-sdk/*, etc.)  
❌ Platform-specific packages (Canvas, bcrypt, etc.)  

---

## Advanced Options

### Custom Entry Points

Edit `artifacts/api-server/build.mjs` to add more entry points:

```javascript
entryPoints: {
  main: path.resolve(artifactDir, "src/index.ts"),
  cli: path.resolve(artifactDir, "src/cli.ts"),      // CLI entry
  worker: path.resolve(artifactDir, "src/worker.ts"), // Worker entry
}
```

### Adjust External Packages

Modify the `external` array in `build.mjs` to include/exclude packages from the bundle.

### Enable Tree-Shaking

The build already has tree-shaking enabled. Ensure:
- Dependencies use ES modules (`"type": "module"`)
- Code is written in modern ES syntax
- No dynamic `require()` calls

---

## Troubleshooting

### Build fails with "Module not found"

1. Check that all dependencies are installed: `pnpm install`
2. Verify the package is in `package.json` dependencies
3. If it's a native module, it might need to be externalized

### Bundle is too large

1. Enable minification: `MINIFY=true pnpm build`
2. Check for unused dependencies: `npm ls --depth=0`
3. Exclude optional packages from the bundle
4. Use code splitting (for multiple entry points)

### Source maps not working

Set `SOURCEMAP=external` for separate `.map` files in production:
```bash
NODE_ENV=production SOURCEMAP=external pnpm build
```

### Performance issues at startup

1. Review the bundle size
2. Consider lazy-loading large dependencies
3. Enable compression: `COMPRESS=true`
4. Use Node.js 20+ for better performance

---

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Build API Server
  run: |
    NODE_ENV=production \
    MINIFY=true \
    COMPRESS=true \
    pnpm -C artifacts/api-server build:prod:all
    
- name: Upload artifacts
  uses: actions/upload-artifact@v3
  with:
    name: api-server-bundle
    path: artifacts/api-server/dist/
```

---

## Next Steps

1. ✅ Run your first build: `pnpm build`
2. 🚀 Start the server: `pnpm -C artifacts/api-server start`
3. 📦 Customize build options in `build.mjs`
4. 🔍 Monitor bundle size with compression enabled
5. 🌐 Deploy to your hosting platform

