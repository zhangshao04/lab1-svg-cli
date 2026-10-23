import { GeometricShape } from "./GeometricShape.js";

export class Ellipse extends GeometricShape {
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id, "ellipse", { cx, cy, rx, ry }, ["cx"], ["cy"], ["rx", "ry"]);
  }
  override clone(): Ellipse {
    return this.copyPresentationTo(new Ellipse(this.getId(), this.number("cx"), this.number("cy"), this.number("rx"), this.number("ry")));
  }
  override describeGeometry(): string {
    return `cx=${this.formatted("cx")} cy=${this.formatted("cy")} rx=${this.formatted("rx")} ry=${this.formatted("ry")}`;
  }
}

