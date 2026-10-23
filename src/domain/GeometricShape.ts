import { Numbers } from "./Numbers.js";
import { Shape } from "./Shape.js";

export abstract class GeometricShape extends Shape {
  private geometry: Map<string, number>;

  protected constructor(
    id: string, tag: string, values: Readonly<Record<string, number>>,
    private readonly xCoordinates: readonly string[],
    private readonly yCoordinates: readonly string[],
    private readonly lengths: readonly string[],
  ) {
    super(id, tag);
    this.geometry = new Map(Object.entries(values));
    this.validate(this.geometry);
  }

  protected number(name: string): number {
    const value = this.geometry.get(name);
    if (value === undefined) throw new Error(`missing geometry: ${name}`);
    return value;
  }

  protected formatted(name: string): string { return Numbers.format(this.number(name)); }

  override move(dx: number, dy: number): void {
    Numbers.finite(dx, "dx");
    Numbers.finite(dy, "dy");
    const next = new Map(this.geometry);
    for (const key of this.xCoordinates) next.set(key, this.number(key) + dx);
    for (const key of this.yCoordinates) next.set(key, this.number(key) + dy);
    this.validate(next);
    this.geometry = next;
  }

  override scale(factor: number): void {
    Numbers.positive(factor, "scale factor");
    const next = new Map([...this.geometry].map(([key, value]) => [key, value * factor]));
    this.validate(next);
    this.geometry = next;
  }

  override setAttribute(name: string, value: string): void {
    if (!this.geometry.has(name)) return super.setAttribute(name, value);
    const next = new Map(this.geometry);
    next.set(name, Numbers.parse(value, name));
    this.validate(next);
    this.geometry = next;
  }

  override getAttributes(): Readonly<Record<string, string>> {
    return {
      ...super.getAttributes(),
      ...Object.fromEntries([...this.geometry].map(([key, value]) => [key, Numbers.format(value)])),
    };
  }

  private validate(values: ReadonlyMap<string, number>): void {
    for (const [key, value] of values) {
      if (this.lengths.includes(key)) Numbers.nonNegative(value, key);
      else Numbers.finite(value, key);
    }
  }
}

