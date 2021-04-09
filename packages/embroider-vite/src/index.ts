import { realpathSync, readFileSync } from 'fs';
import { join } from 'path';
import { AppMeta, PackagerInstance, Variant } from '@embroider/core';
import { build, BuildOptions, InlineConfig } from 'vite';
import { babel } from '@rollup/plugin-babel';

type AllowedBuildOptions = Omit<BuildOptions, 'outDir'>;
type AllowedViteConfig = Omit<InlineConfig, 'build' | 'root'> & {
  build?: AllowedBuildOptions;
};

interface Options {
  viteConfig: AllowedViteConfig;
}

export class VitePackager implements PackagerInstance {
  static annotation = 'embroider-vite';

  private viteConfig: AllowedViteConfig;

  pathToVanillaApp: string;

  constructor(
    pathToVanillaApp: string,
    private outputPath: string,
    _variants: Variant[],
    _consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(pathToVanillaApp);

    this.viteConfig = options?.viteConfig ?? {};
  }

  async build(): Promise<void> {
    const meta = JSON.parse(readFileSync(join(this.pathToVanillaApp, 'package.json'), 'utf8'))[
      'ember-addon'
    ] as AppMeta;

    await build({
      ...this.viteConfig,
      logLevel: 'error',
      plugins: [
        babel({
          babelHelpers: 'runtime',
          configFile: join(this.pathToVanillaApp, meta.babel.filename),
          filter: require(join(this.pathToVanillaApp, meta.babel.fileFilter)),
        }),
        ...(this.viteConfig.plugins ?? []),
      ],
      root: this.pathToVanillaApp,
      build: {
        ...this.viteConfig.build,
        outDir: this.outputPath,
      },
    });
  }
}
