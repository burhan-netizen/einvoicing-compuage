import { build } from 'esbuild';
await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'esm', target: ['es2020'], outfile: 'public/app.js', legalComments: 'none' });
console.log('built public/app.js');
