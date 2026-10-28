import fs from 'node:fs';
import path from 'node:path';
import { createBuilder } from 'vite';

// Vercel's adapter creates directory links without a type. Windows requires
// elevation for those symlinks, but directory junctions work without elevation.
// Limit the fallback to generated Vercel output; Linux/Vercel uses the original.
const original = fs.symlinkSync;
if (process.platform === 'win32') {
  fs.symlinkSync = function (target, destination, type) {
    try {
      return original(target, destination, type);
    } catch (error) {
      const output = path.resolve('.vercel/output');
      const resolvedDestination = path.resolve(String(destination));
      const resolvedTarget = path.resolve(path.dirname(resolvedDestination), String(target));
      const inside = (candidate) => candidate.startsWith(output + path.sep);
      if (
        error.code !== 'EPERM' ||
        !inside(resolvedDestination) ||
        !inside(resolvedTarget) ||
        !fs.statSync(resolvedTarget).isDirectory()
      )
        throw error;
      return original(resolvedTarget, resolvedDestination, 'junction');
    }
  };
}
try {
  const builder = await createBuilder();
  await builder.buildApp();
} finally {
  fs.symlinkSync = original;
}
