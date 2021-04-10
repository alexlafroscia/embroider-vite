import { realpathSync, readFileSync } from 'fs';
import { copyFile } from 'fs/promises';
import { join, parse } from 'path';
import { AppMeta, PackagerInstance, Variant } from '@embroider/core';
import { build, BuildOptions, InlineConfig } from 'vite';
import templateCompilerPlugin from 'rollup-plugin-glimmer-template-compiler';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

type RollupOptions = Required<BuildOptions['rollupOptions']>;
type AllowedRollupOptions = Omit<RollupOptions, 'input'>;

type AllowedBuildOptions = Omit<BuildOptions, 'outDir' | 'rollupOptions'> & {
  rollupOptions?: AllowedRollupOptions;
};

type AllowedViteConfig = Omit<InlineConfig, 'base' | 'build' | 'mode' | 'resolve' | 'root'> & {
  build?: AllowedBuildOptions;
};

interface Options {
  viteConfig: AllowedViteConfig;
}

export class VitePackager implements PackagerInstance {
  static annotation = 'embroider-vite';

  private viteConfig: AllowedViteConfig;
  private variant: Variant;

  pathToVanillaApp: string;

  constructor(
    pathToVanillaApp: string,
    private outputPath: string,
    variants: Variant[],
    _consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(pathToVanillaApp);

    // For now we're not worried about building each variant
    // Let's just assume we have one
    this.variant = variants[0];

    this.viteConfig = options?.viteConfig ?? {};
  }

  async build(): Promise<void> {
    const meta = this.getAppMeta();

    const entryPoints = meta.assets
      .map((asset) => parse(asset))
      .filter((asset) => asset.ext === '.html')
      .map((asset) => join(this.pathToVanillaApp, asset.dir, asset.base));

    await build({
      ...this.viteConfig,
      mode: this.variant.optimizeForProduction ? 'production' : 'development',
      logLevel: 'error',
      plugins: [
        templateCompilerPlugin({
          templateCompilerFile: join(this.pathToVanillaApp, meta['template-compiler'].filename),
          variant: this.variant,
        }),
        babel({
          // Embroider includes the Runtime plugin in the generated Babel config
          babelHelpers: 'runtime',

          // Path to the Embroider-generated Babel config
          configFile: join(this.pathToVanillaApp, meta.babel.filename),

          // Path to the Embroider-generated file defining a filtering function
          filter: require(join(this.pathToVanillaApp, meta.babel.fileFilter)),
        }),
        commonjs(),
        ...(this.viteConfig.plugins ?? []),
      ],
      root: this.pathToVanillaApp,
      base: meta['root-url'],
      resolve: {
        extensions: meta['resolvable-extensions'],
      },
      build: {
        ...this.viteConfig.build,
        outDir: this.outputPath,
        rollupOptions: {
          ...this.viteConfig.build?.rollupOptions,
          input: entryPoints,
        },
      },
    });

    // Copy over the `vendor.js` file that is ignored by Vite
    await this.passThrough('assets/vendor.js');
    await this.passThrough('assets/vendor.map');
  }

  private getAppMeta(): AppMeta {
    return JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'))[
      'ember-addon'
    ] as AppMeta;
  }

  private async passThrough(path: string) {
    const source = join(this.pathToVanillaApp, path);
    const dest = join(this.outputPath, path);

    await copyFile(source, dest);
  }
}
