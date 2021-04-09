import { opendir } from 'fs/promises';
import { join } from 'path';

/**
 * @link {https://gist.github.com/lovasoa/8691344#file-node-walk-es6}
 */
export async function* walk(dir: string): AsyncGenerator<string> {
  for await (const d of await opendir(dir)) {
    const entry = join(dir, d.name);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}
