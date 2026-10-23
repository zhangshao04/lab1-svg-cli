import { Numbers } from "./Numbers.js";

export abstract class Shape {
  private readonly presentation = new Map<string, string>();

  protected constructor(private readonly id: string, private readonly tag: string) {
    if (!id || /\s/.test(id)) throw new Error("id must be non-empty and contain no whitespace");
  }

  getId(): string { return this.id; }
  getTag(): string { return this.tag; }
  label(): string { return `${this.tag}#${this.id}`; }
  getChildren(): readonly Shape[] { return []; }
  getText(): string | undefined { return undefined; }

  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract clone(): Shape;
  abstract describeGeometry(): string;

  setAttribute(name: string, value: string): void {
    if (!["fill", "stroke", "stroke-width"].includes(name)) {
      throw new Error(`unknown attribute: ${name}`);
    }
    if (name === "stroke-width") {
      value = Numbers.format(Numbers.nonNegative(Numbers.parse(value, name), name));
    }
    this.presentation.set(name, value);
  }

  // Only the SVG reader calls this. The CLI attribute whitelist stays narrow.
  importPresentation(attributes: Readonly<Record<string, string>>): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (["fill", "stroke", "stroke-width"].includes(name)) this.setAttribute(name, value);
      else if (/^data-[\w.-]+$/.test(name) || [
        "font-size", "font-family", "font-weight", "font-style", "text-anchor",
        "dominant-baseline", "opacity", "fill-opacity", "stroke-opacity",
        "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "visibility",
      ].includes(name)) this.presentation.set(name, value);
      else throw new Error(`unsupported SVG attribute: ${name}`);
    }
  }

  getAttributes(): Readonly<Record<string, string>> {
    return { id: this.id, ...Object.fromEntries(this.presentation) };
  }

  summary(): string {
    return [this.label(), this.describeGeometry(), this.describePresentation()].filter(Boolean).join("  ");
  }

  details(parent: string): string {
    return [`${this.label()}  parent=${parent}`, this.describeGeometry(), this.describePresentation()]
      .filter(Boolean).map((line, index) => index === 0 ? line : `  ${line}`).join("\n");
  }

  walk(): readonly Shape[] {
    return [this, ...this.getChildren().flatMap(child => child.walk())];
  }

  protected copyPresentationTo<T extends Shape>(target: T): T {
    target.importPresentation(Object.fromEntries(this.presentation));
    return target;
  }

  private describePresentation(): string {
    return [...this.presentation].map(([name, value]) => `${name}=${value}`).join(" ");
  }
}

