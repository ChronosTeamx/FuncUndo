const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

/**
 * Copies sql-wasm.wasm into dist/ after every build
 * @type {import('esbuild').Plugin}
 */
const copyWasmPlugin = {
  name: 'copy-wasm',
  setup(build) {
    build.onEnd(() => {
      const src  = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      const dest = path.join(__dirname, 'dist', 'sql-wasm.wasm');

      if (!fs.existsSync(path.join(__dirname, 'dist'))) {
        fs.mkdirSync(path.join(__dirname, 'dist'));
      }

      fs.copyFileSync(src, dest);
      console.log('[build] sql-wasm.wasm → dist/');
    });
  },
};


async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts', 'src/worker/parser.worker.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outdir: 'dist',
    external: ['vscode','sql.js'],
    logLevel: 'silent',
    plugins: [
      /* add to the end of plugins array */
      copyWasmPlugin, 
      esbuildProblemMatcherPlugin,
    ],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
