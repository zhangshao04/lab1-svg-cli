import { Numbers } from "./Numbers.js";
import { Shape } from "./Shape.js";

export class Group extends Shape {
  private readonly children: Shape[] = [];

  constructor(id: string) { super(id, "g"); }
  override getChildren(): readonly Shape[] { return [...this.children]; }
  override describeGeometry(): string { return ""; }

  insert(shape: Shape, index = this.children.length): void {
    if (shape.walk().includes(this)) throw new Error(`cannot group a container into its own descendant: ${shape.getId()}`);
    if (this.children.includes(shape)) throw new Error(`shape already in container: ${shape.getId()}`);
    if (!Number.isInteger(index) || index < 0 || index > this.children.length) throw new Error("invalid child position");
    this.children.splice(index, 0, shape);
  }

  remove(shape: Shape): void {
    const index = this.children.indexOf(shape);
    if (index < 0) throw new Error(`shape not in container: ${shape.getId()}`);
    this.children.splice(index, 1);
  }

  override move(dx: number, dy: number): void {
    Numbers.finite(dx, "dx");
    Numbers.finite(dy, "dy");
    for (const child of this.children) child.move(dx, dy);
  }

  override scale(factor: number): void {
    Numbers.positive(factor, "scale factor");
    for (const child of this.children) child.scale(factor);
  }

  override clone(): Group {
    const copy = this.copyPresentationTo(new Group(this.getId()));
    for (const child of this.children) copy.insert(child.clone());
    return copy;
  }
}

