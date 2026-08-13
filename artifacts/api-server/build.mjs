import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, writeFile, readFile } from "node:fs/promises";
import fs from "node:fs";
import zlib from "node:zlib";
import { promisify } from "node:util";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const gzip = promisify(zlib.gzip);

// ===== CONFIGURATION =====
const config = {
  // Output formats
  formats: process.env.BUILD_FORMAT ? [process.env.BUILD_FORMAT] : ['esm'],
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Entry points
  entryPoints: {
    main: path.resolve(artifactDir, "src/index.ts"),
  },
  
  // Output directory
  outDir: path.resolve(artifactDir, "dist"),
  
  // Minification
  minify: process.env.MINIFY === 'true' || process.env.NODE_ENV === 'production',
  
  // Source maps
  sourcemap: process.env.SOURCEMAP || 'linked',
  
  // Compress output
  compress: process.env.COMPRESS === 'true',
  
  // Log level
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'info'),
  
  // External packages (native modules, large libraries)
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "xxhash-addon",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "isolated-vm",
    "lightningcss",
    "pg-native",
    "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "handlebars",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@prisma/client",
    "@mikro-orm/*",
    "@grpc/*",
    "@swc/*",
    "@aws-sdk/*",
    "@azure/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "@google/*",
    "googleapis",
    "firebase-admin",
    "@parcel/watcher",
    "@sentry/profiling-node",
    "@tree-sitter/*",
    "aws-sdk",
    "classic-level",
    "dd-trace",
    "ffi-napi",
    "grpc",
    "hiredis",
    "kerberos",
    "leveldown",
    "miniflare",
    "mysql2",
    "newrelic",
    "odbc",
    "piscina",
    "realm",
    "ref-napi",
    "rocksdb",
    "sass-embedded",
    "sequelize",
    "serialport",
    "snappy",
    "tinypool",
    "usb",
    "workerd",
    "wrangler",
    "zeromq",
    "zeromq-prebuilt",
    "playwright",
    "puppeteer",
    "puppeteer-core",
    "electron",
  ],
};

// ===== HELPER FUNCTIONS =====

/**
 * Get file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file size
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Compress file with gzip
 */
async function compressFile(filePath) {
  try {
    const data = await readFile(filePath);
    const compressed = await gzip(data);
    const compressedPath = `${filePath}.gz`;
    await writeFile(compressedPath, compressed);
    const originalSize = data.length;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);
    console.log(`  ✓ Compressed: ${path.basename(filePath)}`);
    console.log(`    Original: ${formatFileSize(originalSize)}`);
    console.log(`    Compressed: ${formatFileSize(compressedSize)} (${ratio}% reduction)`);
    return compressedPath;
  } catch (err) {
    console.error(`  ✗ Compression failed for ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Generate build report
 */
async function generateBuildReport(format, outputFile) {
  const fileSize = await getFileSize(outputFile);
  const timestamp = new Date().toISOString();
  
  const report = {
    timestamp,
    format,
    environment: config.environment,
    file: path.basename(outputFile),
    size: {
      bytes: fileSize,
      formatted: formatFileSize(fileSize),
    },
    minified: config.minify,
    sourcemap: config.sourcemap,
    compressed: config.compress,
  };
  
  return report;
}

/**
 * Build for a single format
 */
async function buildFormat(format) {
  console.log(`\n📦 Building ${format.toUpperCase()} format...`);
  
  const outExtension = format === 'cjs' ? { '.js': '.cjs' } : 
                       format === 'iife' ? { '.js': '.js' } : 
                       { '.js': '.mjs' };
  
  const formatConfig = {
    entryPoints: [config.entryPoints.main],
    platform: format === 'iife' ? 'browser' : 'node',
    bundle: true,
    format,
    outdir: config.outDir,
    outExtension,
    logLevel: config.logLevel,
    external: config.external,
    minify: config.minify,
    sourcemap: config.sourcemap === 'none' ? false : config.sourcemap,
  };
  
  // Add environment-specific defines
  const defines = {
    'process.env.NODE_ENV': JSON.stringify(config.environment),
  };
  
  if (process.env.BUILD_ID) {
    defines['process.env.BUILD_ID'] = JSON.stringify(process.env.BUILD_ID);
  }
  
  formatConfig.define = defines;
  
  // Add banner for CommonJS compatibility in ESM
  if (format === 'esm') {
    formatConfig.banner = {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
    };
  }
  
  // Add pino plugin for logging
  formatConfig.plugins = [
    esbuildPluginPino({ transports: ["pino-pretty"] })
  ];
  
  try {
    const result = await esbuild(formatConfig);
    
    // Determine output file
    const ext = outExtension['.js'];
    const outputFile = path.join(config.outDir, `index${ext}`);
    
    // Generate report
    const report = await generateBuildReport(format, outputFile);
    console.log(`  ✓ Built successfully`);
    console.log(`    Size: ${report.size.formatted}`);
    
    // Compress if enabled
    if (config.compress) {
      await compressFile(outputFile);
    }
    
    return { success: true, format, report };
  } catch (err) {
    console.error(`  ✗ Build failed:`, err.message);
    return { success: false, format, error: err };
  }
}

/**
 * Main build function
 */
async function buildAll() {
  console.log(`\n🚀 Starting build process...`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Minify: ${config.minify}`);
  console.log(`   Source maps: ${config.sourcemap}`);
  console.log(`   Compress: ${config.compress}`);
  
  // Clean output directory
  console.log(`\n🧹 Cleaning output directory...`);
  await rm(config.outDir, { recursive: true, force: true });
  console.log(`   ✓ Cleaned`);
  
  // Build each format
  const results = [];
  for (const format of config.formats) {
    const result = await buildFormat(format);
    results.push(result);
  }
  
  // Summary
  console.log(`\n📊 Build Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  let successCount = 0;
  for (const result of results) {
    if (result.success) {
      successCount++;
      console.log(`✓ ${result.format.toUpperCase()}: ${result.report.size.formatted}`);
    } else {
      console.log(`✗ ${result.format.toUpperCase()}: FAILED`);
    }
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Result: ${successCount}/${config.formats.length} formats built successfully\n`);
  
  // Exit with error if any build failed
  if (successCount !== config.formats.length) {
    process.exit(1);
  }
}

// ===== RUN BUILD =====
buildAll().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
