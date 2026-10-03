import { rm } from 'node:fs/promises';
// TypeScript does not remove output for deleted sources.
await rm(new URL('../dist/sandbox/',import.meta.url),{recursive:true,force:true});
