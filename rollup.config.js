import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy';

const production = process.env.NODE_ENV === 'production' || !process.env.ROLLUP_WATCH;

// Forge Custom UI resources (see manifest.yml `resources`). Built into static/, which is not committed.
function customUi(name, assets) {
  return {
    input: `src/forge/${name}/main.js`,
    output: {
      format: 'es',
      file: `static/${name}/${name}.js`,
      inlineDynamicImports: true,
    },
    plugins: [
      copy({
        targets: [
          { src: `src/forge/${name}/index.html`, dest: `static/${name}` },
          ...assets.map((src) => ({ src, dest: `static/${name}` })),
        ],
      }),
      postcss({
        extract: `${name}.css`,
        minimize: production,
        config: false,
      }),
      resolve({ browser: true, dedupe: ['preact'] }),
      commonjs(),
      production && terser(),
    ],
  };
}

export default [
  customUi('panel', [
    'public/spinner.svg',
    'public/icon_80x80.png',
    'public/no-image-placeholder.png',
    'public/trash-icon.svg',
  ]),
  customUi('dialog', ['public/spinner.svg', 'public/no-image-placeholder.png']),
];
