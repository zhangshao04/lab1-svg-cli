import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SvgCodec } from "../src/infrastructure/SvgCodec.js";

test("real CLI accepts CRLF input, recovers from an error, and returns batch failure", () => {
  const result = spawnSync(process.execPath, ["dist/src/main.js"], {
    input: 'init 200 100\r\ncreate rect r 1 2 3 4 red\r\nscale r -1\r\nmove r 10 20\r\nshow r\r\n',
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /error: scale factor must be positive/);
  assert.match(result.stdout, /x=11 y=22 w=3 h=4/);
  assert.equal(result.stderr, "");
});

test("real --script mode writes browser-compatible SVG from the assignment flowchart", async () => {
  const folder = await mkdtemp(join(tmpdir(), "svg-editor-cli-"));
  try {
    const commands = (await readFile("examples/flowchart.txt", "utf8")).replace("save examples/flowchart.svg", "save result.svg");
    const script = join(folder, "flowchart.txt");
    await writeFile(script, commands, "utf8");
    const result = spawnSync(process.execPath, [resolve("dist/src/main.js"), "--script", script], {
      cwd: folder, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /saved to result.svg \(8 elements\)/);
    const { document } = new SvgCodec().decode(await readFile(join(folder, "result.svg"), "utf8"));
    assert.equal(document.find("process").getAttributes().y, "100");
    assert.equal(document.find("process-label").getText(), "处理数据 v2");
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test("invalid startup arguments and missing scripts fail clearly", () => {
  const invalid = spawnSync(process.execPath, ["dist/src/main.js", "--bad"], { encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /usage:/);
  const missing = spawnSync(process.execPath, ["dist/src/main.js", "--script", "missing-file.txt"], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^error:/);
});

