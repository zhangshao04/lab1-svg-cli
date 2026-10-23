import { GeometricShape } from "./GeometricShape.js";

export class Line extends GeometricShape {
  constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id, "line", { x1, y1, x2, y2 }, ["x1", "x2"], ["y1", "y2"], []);
  }
  override clone(): Line {
    return this.copyPresentationTo(new Line(this.getId(), this.number("x1"), this.number("y1"), this.number("x2"), this.number("y2")));
  }
  override describeGeometry(): string {
    return `(${this.formatted("x1")},${this.formatted("y1")}) -> (${this.formatted("x2")},${this.formatted("y2")})`;
  }
}

