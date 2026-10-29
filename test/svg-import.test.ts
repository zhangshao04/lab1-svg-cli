import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { EditorSession } from "../src/application/EditorSession.js";
import { CommandProcessor } from "../src/cli/CommandProcessor.js";
import { FileDocumentStore } from "../src/infrastructure/FileDocumentStore.js";
import { SvgCodec } from "../src/infrastructure/SvgCodec.js";

const codec = new SvgCodec();

test("root attributes reject invalid XML characters while valid Unicode survives", () => {
  for (const name of ["id", "version", "preserveAspectRatio"]) {
    for (const value of ["&#0;", "&#x1;", "&#xD800;", "&#xFFFE;", "&#xFFFF;", "\u0000"]) {
      assert.throws(() => codec.decode(`<svg ${name}="a${value}b"/>`), /SVG/, `${name}: ${value}`);
    }
  }
  const { document } = codec.decode('<svg id="画布😀" version="1.1" preserveAspectRatio="xMidYMid meet"><text id="t">中文😀&#13;&#10;</text></svg>');
  const restored = codec.decode(codec.encode(document)).document;
  assert.deepEqual(restored.getRootAttributes(), document.getRootAttributes());
  assert.equal(restored.find("t").getText(), "中文😀\r\n");
});

test("rejected SVG imports preserve the document, read path and undo redo history", async () => {
  const temporaryRoot = resolve(tmpdir());
  const folder = await mkdtemp(join(temporaryRoot, "svg-editor-import-test-"));
  try {
    const store = new FileDocumentStore();
    const session = new EditorSession(store);
    const cli = new CommandProcessor(session);
    const originalPath = join(folder, "original.svg");
    const badPath = join(folder, "invalid.svg");
    for (const line of ["init", "create circle c 1 2 3", `save "${originalPath}"`,
      `read "${originalPath}"`, "move c 20 0", "undo"]) {
      assert.doesNotMatch(await cli.run(line), /^error:/, line);
    }
    const before = codec.encode(session.getDocument());
    for (const source of [
      '<svg id="a&#0;b"/>',
      '<svg version="a&#xD800;b"/>',
      '<svg preserveAspectRatio="a&#xFFFE;b"/>',
      '<!DOCTYPE svg><svg/>',
      '<svg><g transform="scale(2)" stroke-dasharray="5% 2%"><line id="l"/></g></svg>',
    ]) {
      await writeFile(badPath, source, "utf8");
      assert.match(await cli.run(`read "${badPath}"`), /^error:/, source);
      assert.equal(codec.encode(session.getDocument()), before, source);
      assert.match(await cli.run("redo"), /^redone:/, source);
      assert.equal(session.getDocument().find("c").getAttributes().cx, "21");
      assert.match(await cli.run("undo"), /^undone:/, source);
    }
    await cli.run("redo");
    assert.equal(await cli.run("save"), `saved to ${originalPath} (1 elements)`);
    assert.equal((await store.read(originalPath)).document.find("c").getAttributes().cx, "21");
  } finally {
    assert.equal(dirname(folder), temporaryRoot);
    await rm(folder, { recursive: true, force: true });
  }
});

test("declaration-like comments, CDATA and escaped text import and round-trip", () => {
  const source = `<!-- example <!DOCTYPE svg> -->
    <svg data-note="&lt;!ENTITY example&gt;">
      <text id="t">before <![CDATA[<!DOCTYPE svg> <!ENTITY x "value">]]><!-- <!ENTITY ignored> --> after</text>
      <text id="escaped">&lt;!DOCTYPE svg&gt;</text>
    </svg>`;
  const { document } = codec.decode(source);
  assert.equal(document.size(), 2);
  assert.equal(document.find("t").getText(), 'before <!DOCTYPE svg> <!ENTITY x "value"> after');
  assert.equal(document.find("escaped").getText(), "<!DOCTYPE svg>");
  const restored = codec.decode(codec.encode(document)).document;
  assert.equal(restored.tree(), document.tree());
  assert.equal(restored.getRootAttributes()["data-note"], "<!ENTITY example>");
});

test("actual doctypes and entity declarations remain rejected", () => {
  for (const source of [
    '<!DOCTYPE svg><svg/>',
    '<!DOCTYPE svg SYSTEM "https://example.invalid/unused.dtd"><svg/>',
    '<!DOCTYPE svg [<!ENTITY x "value">]><svg/>',
    '<!DOCTYPE svg [<!ENTITY x "value">]><svg><text id="t">&x;</text></svg>',
    '<!ENTITY x "value"><svg/>',
    '<svg><!DOCTYPE svg></svg>',
  ]) assert.throws(() => codec.decode(source), /invalid SVG:/, source);
});

test("scaled dash arrays include root inheritance, nested overrides and explicit leaf values", () => {
  const { document } = codec.decode(`<svg transform="scale(2)" stroke="black" stroke-dasharray="5 5">
    <line id="root-inherited" x2="10"/>
    <g id="outer" transform="scale(4)" stroke-dasharray="2px, 3, 0">
      <line id="inherited" x2="10"/>
      <line id="explicit" x2="10" stroke-dasharray="1 .5"/>
      <g id="inner" transform="scale(.5)"><line id="nested" x2="10"/></g>
    </g>
  </svg>`);
  for (const [id, dashes, x2] of [
    ["root-inherited", "10 10", "20"], ["inherited", "16 24 0", "80"],
    ["explicit", "8 4", "80"], ["nested", "8 12 0", "40"],
  ] as const) {
    assert.equal(document.find(id).getAttributes()["stroke-dasharray"], dashes, id);
    assert.equal(document.find(id).getAttributes().x2, x2, id);
  }
  assert.equal(codec.decode(codec.encode(document)).document.tree(), document.tree());
});

test("dash scaling respects none, inheritance resets, zero lengths and odd patterns", () => {
  const { document } = codec.decode(`<svg stroke-dasharray="4 2"><g id="g" transform="scale(2)">
    <line id="none" stroke-dasharray="none"/>
    <line id="inherit" stroke-dasharray="inherit"/>
    <line id="unset" stroke-dasharray="unset"/>
    <line id="initial" stroke-dasharray="initial"/>
    <line id="zero" stroke-dasharray="0 0"/>
    <line id="odd" stroke-dasharray="1,2px,3e0"/>
  </g></svg>`);
  for (const [id, expected] of [
    ["none", "none"], ["inherit", "8 4"], ["unset", "8 4"],
    ["initial", "initial"], ["zero", "0 0"], ["odd", "2 4 6"],
  ] as const) assert.equal(document.find(id).getAttributes()["stroke-dasharray"], expected, id);
  assert.equal(codec.decode(codec.encode(document)).document.tree(), document.tree());
});

test("translation and cancelling scales preserve relative dash lengths", () => {
  for (const transform of ['translate(5,10)', 'scale(2) scale(.5)']) {
    const { document } = codec.decode(`<svg><g id="g" transform="${transform}" stroke-dasharray="5% 2em"><line id="l"/></g></svg>`);
    assert.equal(document.find("g").getAttributes()["stroke-dasharray"], "5% 2em");
    assert.equal(document.find("l").getAttributes()["stroke-dasharray"], undefined);
    assert.equal(codec.decode(codec.encode(document)).document.tree(), document.tree());
  }
});

test("scaled dash arrays reject unsupported units, malformed lists and overflow", () => {
  for (const pattern of ["5% 2%", "2em 1em", "1cm 2cm", "5,,5", ",5", "5,", "", "-1 2", "1e308 1"]) {
    assert.throws(() => codec.decode(`<svg><line id="l" transform="scale(2)" stroke-dasharray="${pattern}"/></svg>`),
      /stroke-dasharray|finite/, pattern);
  }
});
