import { rm } from "node:fs/promises";

// TypeScript does not remove output for deleted sources.
await Promise.all(
    ["sandbox", "native"].map((directory) =>
        rm(new URL(`../dist/${directory}/`, import.meta.url), {
            recursive: true,
            force: true,
        }),
    ),
);
