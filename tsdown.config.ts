import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = defineConfig([
	{
		entry: 'src/index.ts',
		format: ['cjs'],
		target: 'node12',
		nodeProtocol: 'strip',
		dts: false,
		exports: true,
		fixedExtension: true,
		minify: true,
		shims: true,
		alias: {
			crypto: resolve(__dirname, './src/polyfills/crypto.ts'),
		},
	},
	{
		entry: 'src/index.ts',
		format: ['esm'],
		target: 'node12',
		nodeProtocol: true,
		dts: true,
		exports: {
			customExports: (exports) =>
				Object.fromEntries(
					Object.entries(exports).map(([key, value]) => {
						if (
							typeof value === 'object' &&
							value !== null &&
							(value.import || value.require)
						) {
							const target = value.import || value.require;
							const bunPath = target
								.replace(/^\.\/dist\//, './src/')
								.replace(/\.([cm]?js)$/, '.ts');

							return [key, { bun: bunPath, ...value }];
						}
						return [key, value];
					}),
				),
		},
		minify: true,
		fixedExtension: true,
	},
]);

export default config;
