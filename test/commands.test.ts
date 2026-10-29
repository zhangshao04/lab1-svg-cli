import test from "node:test";
import assert from "node:assert/strict";
import { EditorSession } from "../src/application/EditorSession.js";
import { CommandProcessor } from "../src/cli/CommandProcessor.js";
import { Tokenizer } from "../src/cli/Tokenizer.js";
import { MemoryDocumentStore } from "./MemoryDocumentStore.js";

test("cross-parent grouping and deletion undo restore every parent and sibling order", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  for (const line of ["init", "create g left", "create g right", "create g nested in left",
    "create rect a 1 2 3 4 in nested", "create circle b 1 2 3 in right",
    "create circle c 4 5 6 in right"]) assert.doesNotMatch(await cli.run(line), /^error:/);
  const before = session.getDocument().tree();
  await cli.run("group combined b nested");
  assert.deepEqual(session.getDocument().find("combined").getChildren().map(s => s.getId()), ["nested", "b"]);
  const grouped = session.getDocument().tree();
  await cli.run("delete combined");
  assert.throws(() => session.getDocument().find("a"), /no such shape/);
  await cli.run("undo");
  assert.equal(session.getDocument().tree(), grouped);
  await cli.run("undo");
  assert.equal(session.getDocument().tree(), before);
});

test("specified error messages match and failed attempts never change state", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  await cli.run("init");
  await cli.run("create g scene");
  await cli.run("create rect r1 0 0 10 10 in scene");
  const before = session.getDocument().tree();
  for (const [command, message] of [
    ["create g r1", "id already exists: r1"],
    ["move r9 1 2", "no such shape: r9"],
    ["create g child in node9", "no such container: node9"],
    ["create g child in r1", "not a container: r1"],
    ["create hexagon h", "unknown shape type: hexagon (is the plugin loaded?)"],
    ["group bad r1 scene", "cannot group a container into its own descendant: scene"],
    ["ungroup scene", "cannot ungroup top-level container: scene"],
    ["scale r1 0", "scale factor must be positive"],
    ["set r1 label test", "unknown attribute: label"],
  ]) {
    assert.equal(await cli.run(command!), `error: ${message}`);
    assert.equal(session.getDocument().tree(), before);
  }
});

test("unrepresentable text is rejected without destroying valid Unicode", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  await cli.run("init");
  await cli.run('create text t 0 0 "开始 😀"');
  const before = session.getDocument().tree();
  assert.match(await cli.run('set t text "bad\u0000"'), /^error:/);
  assert.match(await cli.run('set t fill "bad\u0001"'), /^error:/);
  assert.equal(session.getDocument().tree(), before);
});

test("quoted text, empty text, Windows paths, comments and hex colors tokenize correctly", () => {
  const tokenizer = new Tokenizer();
  assert.deepEqual(tokenizer.tokenize('create text t 1 2 "开始 & next"'), ["create", "text", "t", "1", "2", "开始 & next"]);
  assert.deepEqual(tokenizer.tokenize('set t text ""'), ["set", "t", "text", ""]);
  assert.deepEqual(tokenizer.tokenize('set r fill #ffffff'), ["set", "r", "fill", "#ffffff"]);
  assert.deepEqual(tokenizer.tokenize('  # comment'), []);
  assert.deepEqual(tokenizer.tokenize('read "C:\\work space\\a.svg"'), ["read", "C:\\work space\\a.svg"]);
  assert.throws(() => tokenizer.tokenize('set t text "unfinished'), /unterminated/);
});

test("no-document errors and help are available at startup", async () => {
  const cli = new CommandProcessor(new EditorSession(new MemoryDocumentStore()));
  assert.match(await cli.run("move r 1 1"), /^error: no document/);
  assert.match(await cli.run("undo"), /^error: no document/);
  assert.match(await cli.run("help"), /create <type>/);
  assert.equal(await cli.run(" # comment"), "");
});

test("all edit commands are single undo units with exact redo restoration", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  for (const line of ["init", "create g scene", "create g sub in scene",
    "create rect a 10 20 30 40 in sub", "create circle b 2 3 4 in sub",
    "create text t 1 2 \"hello world\" in scene"]) {
    assert.doesNotMatch(await cli.run(line), /^error:/);
  }
  for (const line of [
    "create ellipse e 1 2 3 4 in sub",
    "create line l 1 2 3 4 black in scene",
    "move sub 1.5 -2",
    "scale sub 2",
    "set a fill #abc",
    "set t text \"开始 & done\"",
    "group pair a b",
    "ungroup pair",
    "addto sub t",
    "front a",
    "back a",
    "delete sub",
  ]) {
    const before = session.getDocument().tree();
    assert.doesNotMatch(await cli.run(line), /^error:/, line);
    const after = session.getDocument().tree();
    assert.match(await cli.run("undo"), /^undone:/);
    assert.equal(session.getDocument().tree(), before, `undo ${line}`);
    assert.match(await cli.run("redo"), /^redone:/);
    assert.equal(session.getDocument().tree(), after, `redo ${line}`);
  }
});

test("failed commands preserve both document and redo; new edits clear redo", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  await cli.run("init");
  await cli.run("create circle c 1 2 3");
  await cli.run("move c 10 10");
  await cli.run("undo");
  const before = session.getDocument().tree();
  for (const command of ["scale c 0", "set c r -5", "create circle c 0 0 1",
    "create box b 0 0 1 1 title", "create circle d 0 0 1 in c", "save unwritable.svg",
    "read missing.svg", "canvas -1 3", "init -1 4", "group bad c missing"]) {
    assert.match(await cli.run(command), /^error:/, command);
    assert.equal(session.getDocument().tree(), before, command);
  }
  assert.match(await cli.run("redo"), /^redone:/);
  await cli.run("undo");
  await cli.run("set c fill red");
  assert.equal(await cli.run("redo"), "error: nothing to redo");
});

test("document IO barriers clear old history; queries leave history intact", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  await cli.run("init");
  await cli.run("create circle c 1 2 3");
  await cli.run("save first.svg");
  assert.equal(await cli.run("undo"), "error: undo not allowed after io command");
  await cli.run("move c 5 0");
  for (const query of ["canvas", "tree", "show c", "help"]) assert.doesNotMatch(await cli.run(query), /^error:/);
  assert.match(await cli.run("undo"), /^undone:/);
  assert.equal(session.getDocument().find("c").getAttributes().cx, "1");
  assert.equal(await cli.run("undo"), "error: nothing to undo");
  await cli.run("read first.svg");
  assert.match(await cli.run("redo"), /undo not allowed after io command/);
  await cli.run("move c 1 0");
  await cli.run("canvas 100 200");
  assert.match(await cli.run("undo"), /undo not allowed after io command/);
  await cli.run("move c 1 0");
  await cli.run("save");
  assert.match(await cli.run("redo"), /undo not allowed after io command/);
});

test("default save keeps the read path after saving a copy and follows the next successful read", async () => {
  const store = new MemoryDocumentStore();
  const cli = new CommandProcessor(new EditorSession(store));
  for (const line of ["init", "create circle c 0 0 10", "save original.svg",
    "read original.svg", "save copy.svg", "move c 20 0"]) {
    assert.doesNotMatch(await cli.run(line), /^error:/, line);
  }
  assert.equal(await cli.run("save"), "saved to original.svg (1 elements)");
  assert.equal((await store.read("original.svg")).document.find("c").getAttributes().cx, "20");
  assert.equal((await store.read("copy.svg")).document.find("c").getAttributes().cx, "0");
  assert.equal(await cli.run("undo"), "error: undo not allowed after io command");

  assert.doesNotMatch(await cli.run("read copy.svg"), /^error:/);
  assert.doesNotMatch(await cli.run("move c 3 0"), /^error:/);
  assert.equal(await cli.run("save"), "saved to copy.svg (1 elements)");
  assert.equal((await store.read("copy.svg")).document.find("c").getAttributes().cx, "3");
  assert.equal((await store.read("original.svg")).document.find("c").getAttributes().cx, "20");
});

test("new documents remember successful saves and init clears both read and saved paths", async () => {
  const store = new MemoryDocumentStore();
  const cli = new CommandProcessor(new EditorSession(store));
  await cli.run("init");
  assert.equal(await cli.run("save"), "error: no file path. use 'save <file.svg>'");
  await cli.run("create circle c 0 0 10");
  assert.doesNotMatch(await cli.run("save first.svg"), /^error:/);
  await cli.run("move c 1 0");
  assert.equal(await cli.run("save"), "saved to first.svg (1 elements)");
  assert.doesNotMatch(await cli.run("save second.svg"), /^error:/);
  await cli.run("move c 2 0");
  assert.match(await cli.run("save unwritable.svg"), /^error: cannot write file:/);
  assert.match(await cli.run("read missing.svg"), /^error: cannot read file:/);
  assert.match(await cli.run("undo"), /^undone:/);
  assert.match(await cli.run("redo"), /^redone:/);
  assert.equal(await cli.run("save"), "saved to second.svg (1 elements)");
  assert.equal((await store.read("first.svg")).document.find("c").getAttributes().cx, "1");
  assert.equal((await store.read("second.svg")).document.find("c").getAttributes().cx, "3");

  await cli.run("init");
  assert.equal(await cli.run("save"), "error: no file path. use 'save <file.svg>'");
  await cli.run("read first.svg");
  await cli.run("save copy.svg");
  await cli.run("init");
  assert.equal(await cli.run("save"), "error: no file path. use 'save <file.svg>'");
});

test("failed IO after saving a copy preserves the read path and redo history", async () => {
  const store = new MemoryDocumentStore();
  const session = new EditorSession(store);
  const cli = new CommandProcessor(session);
  for (const line of ["init", "create circle c 0 0 10", "save original.svg",
    "read original.svg", "save copy.svg", "move c 20 0", "undo"]) {
    assert.doesNotMatch(await cli.run(line), /^error:/, line);
  }
  const before = session.getDocument().tree();
  assert.match(await cli.run("save unwritable.svg"), /^error: cannot write file:/);
  assert.match(await cli.run("read missing.svg"), /^error: cannot read file:/);
  assert.equal(session.getDocument().tree(), before);
  assert.match(await cli.run("redo"), /^redone:/);
  assert.equal(await cli.run("save"), "saved to original.svg (1 elements)");
  assert.equal((await store.read("original.svg")).document.find("c").getAttributes().cx, "20");
  assert.equal((await store.read("copy.svg")).document.find("c").getAttributes().cx, "0");
});

test("partially executed recursive overflow is rolled back as a whole", async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandProcessor(session);
  for (const line of ["init", "create g g", "create circle a 1 2 3 in g",
    "create circle b 1e308 2 3 in g"]) await cli.run(line);
  const before = session.getDocument().tree();
  assert.match(await cli.run("scale g 10"), /^error:/);
  assert.equal(session.getDocument().tree(), before);
});

