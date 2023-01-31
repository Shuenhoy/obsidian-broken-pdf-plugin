import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: './src/main.ts',
  output: {
    dir: '.',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  plugins: [
    nodeResolve({ browser: true }),
    typescript(),
    {
      name: "pdf.worker.min.js",

      transform(code, id) {
        if (id.endsWith('pdf.worker.min.js')) {
          return {
            code: `const code = ${JSON.stringify(code)};const blob = new Blob([code], { type: 'application/javascript' }); export default URL.createObjectURL(blob);`,
            map: { mappings: "" }
          };
        }
      }
    },
    commonjs(),
  ]
};