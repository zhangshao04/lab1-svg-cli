import { GeometricShape } from "./GeometricShape.js";

export class Circle extends GeometricShape {
  constructor(id: string, cx: number, cy: number, r: number) {
    super(id, "circle", { cx, cy, r }, ["cx"], ["cy"], ["r"]);
  }
  override clone(): Circle {
    return this.copyPresentationTo(new Circle(this.getId(), this.number("cx"), this.number("cy"), this.number("r")));
  }
  override describeGeometry(): string {
    return `cx=${this.formatted("cx")} cy=${this.formatted("cy")} r=${this.formatted("r")}`;
  }
}

