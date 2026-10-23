import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

test("source follows layer dependencies, one-class-per-file and no switch dispatch", async () => {
  const root = resolve("src");
  const allowed: Record<string, readonly string[]> = {
    domain: ["domain"], application: ["application", "domain"],
    commands: ["commands", "application", "domain"],
    cli: ["cli", "commands", "application"],
    infrastructure: ["infrastructure", "application", "domain"],
  };
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries.filter(item => item.isFile() && item.name.endsWith(".ts"))) {
    const file = resolve(entry.parentPath, entry.name);
    const layer = relative(root, file).split(/[\\/]/)[0]!;
    const source = await readFile(file, "utf8");
    const classes = [...source.matchAll(/export (?:abstract )?class (\w+)/g)].map(match => match[1]!);
    assert.ok(classes.length <= 1, `multiple classes: ${file}`);
    if (classes.length === 1) assert.equal(classes[0], basename(file, ".ts"));
    assert.doesNotMatch(source, /\bswitch\s*\(/, file);
    if (!(layer in allowed)) continue; // main is the composition root.
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const imported = match[1]!;
      if (imported.startsWith(".")) {
        const dependency = relative(root, resolve(dirname(file), imported)).split(/[\\/]/)[0]!;
        assert.ok(allowed[layer]!.includes(dependency), `${file} imports ${dependency}`);
      } else {
        assert.ok(["cli", "infrastructure"].includes(layer), `${file} imports external ${imported}`);
      }
    }
  }
});

