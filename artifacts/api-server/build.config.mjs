/**
 * Build Configuration for API Server
 * Supports multiple output formats, environments, and optimization strategies
 */

export const buildConfig = {
  // ===== OUTPUT FORMAT =====
  formats: {
    esm: {
      format: 'esm',
      outExtension: { '.js': '.mjs' },
      description: 'ECMAScript Module (modern, async-friendly)'
    },
    cjs: {
      format: 'cjs',
      outExtension: { '.js': '.cjs' },
      description: 'CommonJS (Node.js standard, sync-friendly)'
    },
    iife: {
      format: 'iife',
      outExtension: { '.js': '.js' },
      description: 'Browser-ready (Immediately Invoked Function Expression)'
    }
  },

  // ===== ENVIRONMENTS =====
  environments: {
    development: {
      minify: false,
      sourcemap: 'linked',
      logLevel: 'info',
      define: {
        'process.env.NODE_ENV': '"development"',
        'process.env.DEBUG': '"*"'
      }
    },
    production: {
      minify: true,
      sourcemap: 'linked',
      logLevel: 'error',
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env.DEBUG': '""'
      }
    },
    staging: {
      minify: true,
      sourcemap: 'external',
      logLevel: 'warning',
      define: {
        'process.env.NODE_ENV': '"staging"',
        'process.env.DEBUG': '"app:*"'
      }
    }
  },

  // ===== BUNDLE OPTIMIZATION =====
  optimization: {
    // Packages to always exclude from bundle (native modules, large libraries)
    external: [
      '*.node',
      'sharp', 'better-sqlite3', 'sqlite3', 'canvas', 'bcrypt', 'argon2',
      'fsevents', 're2', 'farmhash', 'xxhash-addon', 'bufferutil', 'utf-8-validate',
      'ssh2', 'cpu-features', 'dtrace-provider', 'isolated-vm', 'lightningcss',
      'pg-native', 'oracledb', 'mongodb-client-encryption', 'nodemailer',
      'handlebars', 'knex', 'typeorm', 'protobufjs', 'onnxruntime-node',
      '@tensorflow/*', '@prisma/client', '@mikro-orm/*', '@grpc/*', '@swc/*',
      '@aws-sdk/*', '@azure/*', '@opentelemetry/*', '@google-cloud/*',
      '@google/*', 'googleapis', 'firebase-admin', '@parcel/watcher',
      '@sentry/profiling-node', '@tree-sitter/*', 'aws-sdk', 'classic-level',
      'dd-trace', 'ffi-napi', 'grpc', 'hiredis', 'kerberos', 'leveldown',
      'miniflare', 'mysql2', 'newrelic', 'odbc', 'piscina', 'realm', 'ref-napi',
      'rocksdb', 'sass-embedded', 'sequelize', 'serialport', 'snappy',
      'tinypool', 'usb', 'workerd', 'wrangler', 'zeromq', 'zeromq-prebuilt',
      'playwright', 'puppeteer', 'puppeteer-core', 'electron'
    ],
    
    // Packages to optionally exclude (useful for reducing bundle size)
    optional: [
      'dotenv',
      'winston',
      'morgan',
      'helmet',
      'multer'
    ],
    
    // Tree-shaking and code splitting
    treeShaking: true,
    splitting: true, // Only for esm format
    codeSplit: {}
  },

  // ===== SOURCE MAPS =====
  sourcemaps: {
    linked: {
      type: 'linked',
      description: 'Inline source map reference in bundled file'
    },
    external: {
      type: 'external',
      description: 'Separate .map files for production use'
    },
    inline: {
      type: 'inline',
      description: 'Full source map embedded in bundle (large files)'
    },
    none: {
      type: 'none',
      description: 'No source maps'
    }
  },

  // ===== ENTRY POINTS & MULTI-BUILD =====
  entryPoints: {
    default: './src/index.ts',
    cli: './src/cli.ts',           // CLI entry point (if exists)
    worker: './src/worker.ts'      // Worker entry point (if exists)
  },

  // ===== PLATFORM TARGETS =====
  targets: {
    node18: {
      platform: 'node',
      target: 'node18',
      description: 'Node.js 18+'
    },
    node20: {
      platform: 'node',
      target: 'node20',
      description: 'Node.js 20+ (LTS)'
    },
    browser: {
      platform: 'browser',
      target: 'es2020',
      description: 'Modern browsers (ES2020)'
    }
  },

  // ===== PLUGINS CONFIGURATION =====
  plugins: {
    pino: {
      enabled: true,
      transports: ['pino-pretty'],
      description: 'Handle Pino logging in bundles'
    },
    compression: {
      enabled: false,
      format: 'gzip',
      description: 'Gzip compress output bundles'
    },
    analyze: {
      enabled: false,
      description: 'Generate bundle analysis report'
    }
  },

  // ===== POST-BUILD ACTIONS =====
  postBuild: {
    compress: {
      enabled: false,
      formats: ['gzip', 'brotli'],
      description: 'Compress bundle files'
    },
    upload: {
      enabled: false,
      destination: 's3://bucket-name/builds/',
      description: 'Upload to cloud storage'
    },
    checkSize: {
      enabled: true,
      maxSize: '50mb',
      description: 'Check bundle size limits'
    },
    generateSBOM: {
      enabled: false,
      format: 'cyclonedx',
      description: 'Generate Software Bill of Materials'
    }
  },

  // ===== ENVIRONMENT VARIABLES INJECTION =====
  environmentVariables: {
    development: {
      API_URL: 'http://localhost:3000',
      LOG_LEVEL: 'debug',
      CACHE_TTL: '60'
    },
    staging: {
      API_URL: 'https://staging-api.example.com',
      LOG_LEVEL: 'info',
      CACHE_TTL: '300'
    },
    production: {
      API_URL: 'https://api.example.com',
      LOG_LEVEL: 'warn',
      CACHE_TTL: '3600'
    }
  },

  // ===== BANNER & FOOTER CODE =====
  bannerFooter: {
    commonjs: {
      banner: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
      footer: ''
    },
    tracking: {
      banner: `/* Built on ${new Date().toISOString()} */
/* Build ID: ${process.env.BUILD_ID || 'local'} */`,
      footer: `/* End of bundle */`
    }
  }
};

export default buildConfig;
