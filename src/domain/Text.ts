import { GeometricShape } from "./GeometricShape.js";
import { TextValue } from "./TextValue.js";

export class Text extends GeometricShape {
  constructor(id: string, x: number, y: number, private content: string) {
    super(id, "text", { x, y }, ["x"], ["y"], []);
    this.content = TextValue.validate(content);
  }
  override getText(): string { return this.content; }
  override setAttribute(name: string, value: string): void {
    if (name === "text") this.content = TextValue.validate(value);
    else super.setAttribute(name, value);
  }
  override clone(): Text {
    return this.copyPresentationTo(new Text(this.getId(), this.number("x"), this.number("y"), this.content));
  }
  override describeGeometry(): string {
    return `(${this.formatted("x")},${this.formatted("y")}) ${JSON.stringify(this.content)}`;
  }
}

