import { parse } from 'path';
import type { Plugin as RollupPlugin } from 'rollup';
import { applyVariantToTemplateCompiler, Variant } from '@embroider/core';

export interface Options {
  templateCompilerFile: string;
  variant: Variant;
}

export default function glimmerTemplateCompilerPlugin({
  templateCompilerFile,
  variant,
}: Options): RollupPlugin {
  const templateCompiler = applyVariantToTemplateCompiler(variant, require(templateCompilerFile))
    .compile;

  return {
    name: 'rollup-plugin-glimmer-template-compiler',

    transform(src, id) {
      const parsedFilePath = parse(id);

      if (parsedFilePath.ext === '.hbs') {
        return templateCompiler(id, src);
      }
    },
  };
}
