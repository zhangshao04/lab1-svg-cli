import { GeometricShape } from "./GeometricShape.js";

export class Rect extends GeometricShape {
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id, "rect", { x, y, width, height }, ["x"], ["y"], ["width", "height"]);
  }
  override clone(): Rect {
    return this.copyPresentationTo(new Rect(this.getId(), this.number("x"), this.number("y"), this.number("width"), this.number("height")));
  }
  override describeGeometry(): string {
    return `x=${this.formatted("x")} y=${this.formatted("y")} w=${this.formatted("width")} h=${this.formatted("height")}`;
  }
}

