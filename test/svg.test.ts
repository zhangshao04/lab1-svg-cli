import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EditorSession } from "../src/application/EditorSession.js";
import { CommandProcessor } from "../src/cli/CommandProcessor.js";
import { ShapeFactory } from "../src/domain/ShapeFactory.js";
import { SvgDocument } from "../src/domain/SvgDocument.js";
import { FileDocumentStore } from "../src/infrastructure/FileDocumentStore.js";
import { SvgCodec } from "../src/infrastructure/SvgCodec.js";

const codec = new SvgCodec();

test("serialization preserves representable numeric precision", () => {
  const { document } = codec.decode('<svg><circle id="c" cx="9007199254740991" cy="0.1234567890123456" r="1"/></svg>');
  const attributes = codec.decode(codec.encode(document)).document.find("c").getAttributes();
  assert.equal(attributes.cx, "9007199254740991");
  assert.equal(attributes.cy, "0.1234567890123456");
});

test("root IDs remain reserved for later edits", () => {
  const { document } = codec.decode('<svg id="canvas"><circle id="c"/></svg>');
  assert.throws(() => document.add(new ShapeFactory().create("g", "canvas", [])), /id already exists: canvas/);
  assert.throws(() => document.group("canvas", ["c"]), /id already exists: canvas/);
});

test("read assignment example with missing ID, hierarchy and all seven elements", async () => {
  const source = await readFile("examples/other.svg", "utf8");
  const result = codec.decode(source);
  assert.equal(result.document.size(), 7);
  assert.deepEqual(result.warnings, ["warning: assigned id rect1 to unnamed <rect>"]);
  assert.equal(result.document.getWidth(), 400);
  assert.equal(result.document.parentOf(result.document.find("r2")).getId(), "g1");
  assert.equal(codec.decode(codec.encode(result.document)).document.tree(), result.document.tree());
});

test("automatic IDs reserve later explicit IDs and remain unique across nested groups", () => {
  const { document, warnings } = codec.decode('<svg><rect/><g><rect/><circle/></g><rect id="rect1"/></svg>');
  assert.deepEqual(document.getShapes().map(shape => shape.getId()), ["rect2", "g1", "rect3", "circle1", "rect1"]);
  assert.equal(warnings.length, 4);
  assert.throws(() => codec.decode('<svg><g id="same"><rect id="same"/></g></svg>'), /id already exists: same/);
});

test("SVG round-trip escapes text and attributes and preserves text whitespace", () => {
  const document = new SvgDocument(100, 200);
  const factory = new ShapeFactory();
  const text = factory.create("text", "中文-title", ["1.25", "-2.5", ' 开始 < & > " end ']);
  document.add(text);
  text.setAttribute("fill", 'url("#color")');
  const xml = codec.encode(document);
  assert.match(xml, /&lt;/);
  assert.match(xml, /&amp;/);
  assert.equal(codec.decode(xml).document.find("中文-title").getText(), ' 开始 < & > " end ');
  assert.equal(codec.decode(xml).document.find("中文-title").getAttributes().fill, 'url("#color")');
});

test("text character references preserve CR, LF, CRLF, tabs and literal entity text across repeated round-trips", () => {
  for (const [source, expected] of [
    ["a&#13;b", "a\rb"],
    ["a&#xD;&#xA;b", "a\r\nb"],
    ["a\nb", "a\nb"],
    ["&#9;中文 😀 &#13;&#10;&amp; &lt; &gt; &amp;#13;", "\t中文 😀 \r\n& < > &#13;"],
    ["", ""],
  ] as const) {
    let document = codec.decode(`<svg><text id="t">${source}</text></svg>`).document;
    assert.equal(document.find("t").getText(), expected);
    for (let iteration = 0; iteration < 2; iteration++) {
      const xml = codec.encode(document);
      document = codec.decode(xml).document;
      assert.equal(document.find("t").getText(), expected, source);
      assert.doesNotMatch(xml, /\r/, "carriage returns must be encoded as character references");
    }
  }
});

test("Unicode line separators survive plain text, CDATA and character references", () => {
  for (const point of [0x85, 0x2028, 0x2029]) {
    const separator = String.fromCodePoint(point);
    const expected = `开始${separator}结束`;
    for (const content of [expected, `<![CDATA[${expected}]]>`, `开始&#x${point.toString(16)};结束`]) {
      let document = codec.decode(`<?xml version="1.0"?><svg><text id="t">${content}</text></svg>`).document;
      assert.equal(document.find("t").getText(), expected, `U+${point.toString(16)}`);
      for (let iteration = 0; iteration < 2; iteration++) {
        document = codec.decode(codec.encode(document)).document;
        assert.equal(document.find("t").getText(), expected, `U+${point.toString(16)} round ${iteration}`);
      }
    }
  }
});

test("XML 1.0 normalizes only literal CR and CRLF, preserving Unicode separators and references", () => {
  const source = "a\r\nb\rc\nd\r\u0085e\u0085f\u2028g\u2029h&#13;&#10;&#133;&#8232;&#8233;";
  const expected = "a\nb\nc\nd\n\u0085e\u0085f\u2028g\u2029h\r\n\u0085\u2028\u2029";
  const { document } = codec.decode(`<svg><text id="t">${source}</text></svg>`);
  assert.equal(document.find("t").getText(), expected);
  assert.equal(codec.decode(codec.encode(document)).document.find("t").getText(), expected);
});

test("Unicode line separators survive root and shape attributes", () => {
  const expected = "a\u0085b\u2028c\u2029d";
  for (const value of [expected, "a&#133;b&#8232;c&#8233;d"]) {
    let document = codec.decode(`<svg data-note="${value}"><text id="t" data-note="${value}">标签</text></svg>`).document;
    for (let iteration = 0; iteration < 3; iteration++) {
      assert.equal(document.getRootAttributes()["data-note"], expected);
      assert.equal(document.find("t").getAttributes()["data-note"], expected);
      document = codec.decode(codec.encode(document)).document;
    }
  }
});

test("read and save commands preserve text character references in real files", async () => {
  const folder = await mkdtemp(join(tmpdir(), "svg-editor-text-test-"));
  try {
    const sourcePath = join(folder, "original.svg");
    const copyPath = join(folder, "copy.svg");
    await writeFile(sourcePath, '<svg><text id="t">开始&#13;&#10;下一行&#13;末尾&#9;&amp;#13;</text></svg>', "utf8");
    const store = new FileDocumentStore();
    const cli = new CommandProcessor(new EditorSession(store));
    for (const line of [`read "${sourcePath}"`, `save "${copyPath}"`, "move t 5 0", "save"]) {
      assert.doesNotMatch(await cli.run(line), /^error:/, line);
    }
    for (const path of [sourcePath, copyPath]) {
      const text = (await store.read(path)).document.find("t");
      assert.equal(text.getText(), "开始\r\n下一行\r末尾\t&#13;");
      assert.equal(text.getAttributes().x, path === sourcePath ? "5" : "0");
      assert.match(await readFile(path, "utf8"), /&#13;/);
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test("empty text, absent colors, root appearance, viewBox and data-kind survive round-trip", () => {
  const { document } = codec.decode('<svg width="200px" height="100px" viewBox="-10 -20 200 100" fill="red"><g id="g" data-kind="box"><text id="t" x="0" y="0"></text><line id="l"/></g></svg>');
  const roundTrip = codec.decode(codec.encode(document)).document;
  assert.equal(roundTrip.find("t").getText(), "");
  assert.equal(roundTrip.find("l").getAttributes().stroke, undefined);
  assert.equal(roundTrip.find("g").getAttributes()["data-kind"], "box");
  assert.equal(roundTrip.getRootAttributes().fill, "red");
  assert.equal(roundTrip.getRootAttributes().viewBox, "-10 -20 200 100");
  assert.equal(roundTrip.getWidth(), 200);
});

test("nested translate and uniform scale normalize geometry and text size", async () => {
  const { document, warnings } = codec.decode(await readFile("examples/transforms.svg", "utf8"));
  assert.equal(warnings.length, 2);
  assert.equal(document.find("rect1").getAttributes().x, "260");
  assert.equal(document.find("rect1").getAttributes().y, "40");
  assert.equal(document.find("rect1").getAttributes().width, "96");
  assert.equal(document.find("text1").getAttributes().x, "308");
  assert.equal(document.find("text1").getAttributes().y, "70.4");
  assert.equal(document.find("text1").getAttributes()["font-size"], "12.8");
  assert.equal(document.find("nodeB").getAttributes().transform, undefined);
  assert.equal(codec.decode(codec.encode(document)).document.tree(), document.tree());
});

test("invalid XML, unsupported SVG and transforms are rejected explicitly", () => {
  for (const source of [
    '<svg><rect></svg>', '<svg><rect x="0" x="1"/></svg>', '<html/>',
    '<svg xmlns="urn:wrong"/>', '<svg><path id="p" d="M0 0"/></svg>',
    '<svg><rect id="r" onclick="bad()"/></svg>', '<svg><rect id="r" transform="rotate(30)"/></svg>',
    '<svg><circle transform="scale(2,3)"/></svg>', '<svg><circle transform="scale(0)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "external">]><svg/>', '<svg>unexpected</svg>',
    '<svg><text id="t"><tspan>nested</tspan></text></svg>', '<svg width="100%"/>',
    '<svg viewBox="0 0 -1 2"/>', '<svg><rect id="with space"/></svg>',
  ]) assert.throws(() => codec.decode(source), source);
});

test("file saves replace existing files; failed saves and reads preserve session and history", async () => {
  const folder = await mkdtemp(join(tmpdir(), "svg-editor-test-"));
  try {
    const store = new FileDocumentStore();
    const session = new EditorSession(store);
    const cli = new CommandProcessor(session);
    const path = join(folder, "中文 diagram.svg");
    assert.doesNotMatch(await cli.run("init"), /^error:/);
    await cli.run("create circle c 1 2 3");
    await cli.run(`save "${path}"`);
    await cli.run("move c 2 0");
    await cli.run("save");
    assert.equal((await store.read(path)).document.find("c").getAttributes().cx, "3");
    await cli.run("move c 1 0");
    const before = session.getDocument().tree();
    assert.match(await cli.run(`save "${join(folder, "missing", "bad.svg")}"`), /^error: cannot write file:/);
    await writeFile(join(folder, "invalid.svg"), "<svg><broken", "utf8");
    assert.match(await cli.run(`read "${join(folder, "invalid.svg")}"`), /^error: invalid SVG/);
    assert.equal(session.getDocument().tree(), before);
    assert.match(await cli.run("undo"), /^undone:/);
    assert.equal(session.getDocument().find("c").getAttributes().cx, "3");
    assert.equal((await readdir(folder)).some(name => name.endsWith(".tmp")), false);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

