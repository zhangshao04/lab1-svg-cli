import test from "node:test";
import assert from "node:assert/strict";
import { ShapeFactory } from "../src/domain/ShapeFactory.js";
import { SvgDocument } from "../src/domain/SvgDocument.js";

const factory = new ShapeFactory();

test("all six types implement geometry and preserve omitted appearance", () => {
  for (const [type, args, expected] of [
    ["rect", ["1", "2", "3", "4"], { x: "4", y: "8", width: "6", height: "8" }],
    ["circle", ["1", "2", "3"], { cx: "4", cy: "8", r: "6" }],
    ["ellipse", ["1", "2", "3", "4"], { cx: "4", cy: "8", rx: "6", ry: "8" }],
    ["line", ["1", "2", "3", "4"], { x1: "4", y1: "8", x2: "8", y2: "12" }],
    ["text", ["1", "2", "中文 & words"], { x: "4", y: "8" }],
    ["g", [], {}],
  ] as const) {
    const shape = factory.create(type, "s", args);
    shape.move(1, 2);
    shape.scale(2);
    assert.equal(shape.getAttributes().fill, undefined);
    for (const [key, value] of Object.entries(expected)) assert.equal(shape.getAttributes()[key], value);
    assert.equal(shape.clone().summary(), shape.summary());
  }
});

test("nested groups move/scale recursively and clones are independent", () => {
  const doc = new SvgDocument();
  doc.add(factory.create("g", "outer", []));
  doc.add(factory.create("g", "inner", []), "outer");
  doc.add(factory.create("rect", "r", ["1", "2", "3", "4"]), "inner");
  const before = doc.clone();
  doc.find("outer").move(10, 20);
  doc.find("outer").scale(0.5);
  assert.equal(doc.find("r").getAttributes().x, "5.5");
  assert.equal(before.find("r").getAttributes().x, "1");
  assert.match(doc.tree(), /│|└──/);
});

test("group keeps sibling order, ungroup restores its slot, front/back follow paint order", () => {
  const doc = new SvgDocument();
  doc.add(factory.create("g", "scene", []));
  for (const id of ["a", "b", "c"]) doc.add(factory.create("circle", id, ["0", "0", "1"]), "scene");
  doc.group("pair", ["b", "a"]);
  assert.deepEqual(doc.find("pair").getChildren().map(s => s.getId()), ["a", "b"]);
  doc.ungroup("pair");
  assert.deepEqual(doc.find("scene").getChildren().map(s => s.getId()), ["a", "b", "c"]);
  doc.reorder("a", true);
  assert.deepEqual(doc.find("scene").getChildren().map(s => s.getId()), ["b", "c", "a"]);
  doc.reorder("a", false);
  assert.deepEqual(doc.find("scene").getChildren().map(s => s.getId()), ["a", "b", "c"]);
});

test("invalid structure requests leave the tree untouched", () => {
  const doc = new SvgDocument();
  doc.add(factory.create("g", "outer", []));
  doc.add(factory.create("g", "inner", []), "outer");
  const before = doc.tree();
  assert.throws(() => doc.group("bad", ["outer", "inner"]), /own descendant: outer/);
  assert.throws(() => doc.addTo("inner", "outer"), /own descendant/);
  assert.throws(() => doc.ungroup("outer"), /top-level/);
  assert.throws(() => doc.add(factory.create("g", "inner", [])), /id already exists/);
  assert.equal(doc.tree(), before);
});

test("geometry, attributes, ID case and unsupported types have explicit validation", () => {
  const doc = new SvgDocument();
  doc.add(factory.create("rect", "r", ["0", "0", "10", "20"]));
  doc.add(factory.create("rect", "R", ["0", "0", "10", "20"]));
  const r = doc.find("r");
  assert.throws(() => r.scale(0), /scale factor must be positive/);
  assert.throws(() => r.setAttribute("width", "-1"), /non-negative/);
  assert.throws(() => r.setAttribute("id", "changed"), /unknown attribute/);
  assert.throws(() => factory.create("box", "b", []), /unknown shape type/);
  assert.throws(() => factory.create("circle", "bad", ["NaN", "0", "1"]), /invalid/);
  assert.equal(r.getAttributes().width, "10");
  assert.equal(doc.size(), 2);
});

