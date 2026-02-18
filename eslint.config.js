// ESLint flat config for MSFG Calculator Suite
// Two environments: Node (server) and Browser (client)

const js = require('@eslint/js');

module.exports = [
  // ---- Ignore patterns ----
  {
    ignores: [
      'node_modules/',
      'amort-calc/',        // third-party standalone app
      'deploy/',
      '*.min.js'
    ]
  },

  // ---- Server-side (Node, modern JS) ----
  {
    files: ['server.js', 'routes/**/*.js', 'ecosystem.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^(next|_)' }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'eqeqeq': ['error', 'always'],
      'no-var': 'warn',
      'prefer-const': 'warn'
    }
  },

  // ---- Client-side (browser, ES5 style) ----
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2015,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        fetch: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        Promise: 'readonly',
        Intl: 'readonly',
        Event: 'readonly',
        HTMLElement: 'readonly',
        Image: 'readonly',
        DOMParser: 'readonly',
        html2canvas: 'readonly',
        Chart: 'readonly',
        jspdf: 'readonly',
        pdfMake: 'readonly',
        MSFG: 'writable'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(MSFG|_)', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'eqeqeq': ['error', 'always'],
      // ES5 style — no const/let warnings in client code
      'no-var': 'off',
      'prefer-const': 'off',
      // strict mode enforced by convention (file-level or IIFE-level)
      'strict': 'off'
    }
  },

  // ---- Legacy calculator HTML inline scripts (relaxed) ----
  {
    files: [
      'income/**/*.js',
      'refi-calc/**/*.js',
      'fha-calc/**/*.js',
      'gen-calc/**/*.js',
      'calc-reo/**/*.js',
      'buydown-calc/**/*.js',
      'llpm-calc/**/*.js',
      'batch-llpm/**/*.js',
      'va-calc/**/*.js',
      'apr-calc/**/*.js'
    ],
    languageOptions: {
      ecmaVersion: 2015,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        alert: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Promise: 'readonly',
        Intl: 'readonly',
        MSFG: 'writable',
        html2canvas: 'readonly'
      }
    },
    rules: {
      // Relaxed rules for legacy code — warn only
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'semi': 'warn',
      'eqeqeq': 'warn',
      'no-var': 'off',
      'prefer-const': 'off',
      'strict': 'off',
      'no-undef': 'warn'
    }
  }
];
