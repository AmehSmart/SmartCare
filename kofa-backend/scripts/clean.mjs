import { rm } from 'node:fs/promises';

await Promise.all(
  [
    'dist',
    'coverage',
    'generated',
    'packages/contracts/dist',
    'packages/core/dist',
    'packages/passport-browser/dist',
  ].map((path) => rm(path, { recursive: true, force: true })),
);
