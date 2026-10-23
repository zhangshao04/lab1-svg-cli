import { Group } from "./Group.js";
import { Numbers } from "./Numbers.js";
import type { Shape } from "./Shape.js";

export class SvgDocument {
  private root: Group = new Group("__canvas__");
  private width: number;
  private height: number;
  private rootAttributes: Record<string, string>;

  constructor(width = 800, height = 600, rootAttributes: Readonly<Record<string, string>> = {}) {
    this.width = Numbers.positive(width, "canvas width");
    this.height = Numbers.positive(height, "canvas height");
    this.rootAttributes = { ...rootAttributes };
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
  getChildren(): readonly Shape[] { return this.root.getChildren(); }
  getShapes(): readonly Shape[] { return this.getChildren().flatMap(child => child.walk()); }
  size(): number { return this.getShapes().length; }
  dimensions(): string { return `${Numbers.format(this.width)}x${Numbers.format(this.height)}`; }

  getRootAttributes(): Readonly<Record<string, string>> {
    return {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${Numbers.format(this.width)} ${Numbers.format(this.height)}`,
      ...this.rootAttributes,
      width: Numbers.format(this.width), height: Numbers.format(this.height),
    };
  }

  resize(width: number, height: number): void {
    Numbers.positive(width, "canvas width");
    Numbers.positive(height, "canvas height");
    this.width = width;
    this.height = height;
    this.rootAttributes.viewBox = `0 0 ${Numbers.format(width)} ${Numbers.format(height)}`;
  }

  find(id: string): Shape {
    const shape = this.getShapes().find(candidate => candidate.getId() === id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }

  container(id: string): Group {
    const shape = this.getShapes().find(candidate => candidate.getId() === id);
    if (!shape) throw new Error(`no such container: ${id}`);
    if (!(shape instanceof Group)) throw new Error(`not a container: ${id}`);
    return shape;
  }

  parentOf(shape: Shape): Group {
    const parent = [this.root, ...this.getShapes()].find(candidate => candidate.getChildren().includes(shape));
    if (!(parent instanceof Group)) throw new Error(`no parent for shape: ${shape.getId()}`);
    return parent;
  }

  add(shape: Shape, containerId?: string): void {
    const existing = new Set(this.getShapes().map(item => item.getId()));
    for (const item of shape.walk()) {
      if (existing.has(item.getId())) throw new Error(`id already exists: ${item.getId()}`);
      existing.add(item.getId());
    }
    (containerId === undefined ? this.root : this.container(containerId)).insert(shape);
  }

  delete(id: string): string {
    const shape = this.find(id);
    this.parentOf(shape).remove(shape);
    return `${shape.label()} deleted`;
  }

  group(id: string, ids: readonly string[]): string {
    if (this.getShapes().some(shape => shape.getId() === id)) throw new Error(`id already exists: ${id}`);
    if (ids.length === 0) throw new Error("group requires at least one shape");
    if (new Set(ids).size !== ids.length) throw new Error("duplicate shape in group");
    const selected = ids.map(item => this.find(item));
    for (const shape of selected) {
      if (selected.some(other => other !== shape && shape.walk().includes(other))) {
        throw new Error(`cannot group a container into its own descendant: ${shape.getId()}`);
      }
    }
    // Preserve document paint order, independent of argument order.
    const ordered = this.getShapes().filter(shape => selected.includes(shape));
    const parents = ordered.map(shape => this.parentOf(shape));
    const commonParent = parents.every(parent => parent === parents[0]) ? parents[0]! : this.root;
    const position = commonParent === parents[0] && parents.every(parent => parent === commonParent)
      ? commonParent.getChildren().indexOf(ordered[0]!) : commonParent.getChildren().length;
    const group = new Group(id);
    for (const shape of ordered) {
      this.parentOf(shape).remove(shape);
      group.insert(shape);
    }
    commonParent.insert(group, Math.min(position, commonParent.getChildren().length));
    return `${group.label()} created with ${ordered.length} children`;
  }

  ungroup(id: string): string {
    const group = this.container(id);
    const parent = this.parentOf(group);
    if (parent === this.root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const position = parent.getChildren().indexOf(group);
    const children = group.getChildren();
    parent.remove(group);
    children.forEach((shape, index) => { group.remove(shape); parent.insert(shape, position + index); });
    return `g#${id} ungrouped (${children.length} children)`;
  }

  addTo(containerId: string, id: string): string {
    const target = this.container(containerId);
    const shape = this.find(id);
    if (shape.walk().includes(target)) throw new Error(`cannot group a container into its own descendant: ${id}`);
    this.parentOf(shape).remove(shape);
    target.insert(shape);
    return `${shape.label()} moved into ${target.label()}`;
  }

  reorder(id: string, front: boolean): string {
    const shape = this.find(id);
    const parent = this.parentOf(shape);
    parent.remove(shape);
    parent.insert(shape, front ? parent.getChildren().length : 0);
    return `${shape.label()} moved to ${front ? "front" : "back"}`;
  }

  tree(id?: string): string {
    if (id !== undefined) {
      const shape = this.find(id);
      return [shape.summary(), ...this.treeLines(shape.getChildren(), "")].join("\n");
    }
    return [`svg (${this.dimensions()})`, ...this.treeLines(this.getChildren(), "")].join("\n");
  }

  show(id: string): string {
    const shape = this.find(id);
    const parent = this.parentOf(shape);
    return shape.details(parent === this.root ? "svg" : parent.label());
  }

  clone(): SvgDocument {
    const copy = new SvgDocument(this.width, this.height, this.rootAttributes);
    copy.root = this.root.clone();
    return copy;
  }

  private treeLines(shapes: readonly Shape[], prefix: string): string[] {
    return shapes.flatMap((shape, index) => {
      const last = index === shapes.length - 1;
      return [
        prefix + (last ? "└── " : "├── ") + shape.summary(),
        ...this.treeLines(shape.getChildren(), prefix + (last ? "    " : "│   ")),
      ];
    });
  }
}

