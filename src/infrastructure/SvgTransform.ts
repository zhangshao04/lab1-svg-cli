import { Numbers } from "../domain/Numbers.js";

// Restricted affine transform: positive uniform scale plus translation.
// Geometry is normalized during import, so edits never need tag-based transform dispatch.
export class SvgTransform {
  constructor(
    private readonly factor = 1,
    private readonly dx = 0,
    private readonly dy = 0,
  ) {
    Numbers.positive(factor, "transform scale");
    Numbers.finite(dx, "transform x");
    Numbers.finite(dy, "transform y");
  }

  scale(): number { return this.factor; }
  x(): number { return this.dx; }
  y(): number { return this.dy; }

  compose(inner: SvgTransform): SvgTransform {
    return new SvgTransform(this.factor * inner.factor,
      this.dx + this.factor * inner.dx, this.dy + this.factor * inner.dy);
  }

  static parse(value = ""): SvgTransform {
    let remaining = value.trim();
    let result = new SvgTransform();
    while (remaining) {
      const match = /^(translate|scale)\s*\(([^()]*)\)/.exec(remaining);
      if (!match) throw new Error(`unsupported SVG transform: ${value}`);
      const argumentsText = match[2]!.trim();
      if (!argumentsText || /^,|,$|,\s*,/.test(argumentsText)) throw new Error(`invalid SVG transform: ${value}`);
      const numbers = argumentsText.split(/[\s,]+/).map(item => Numbers.parse(item, "transform"));
      if (numbers.length < 1 || numbers.length > 2) throw new Error(`invalid SVG transform: ${value}`);
      if (match[1] === "translate") result = result.compose(new SvgTransform(1, numbers[0]!, numbers[1] ?? 0));
      else {
        if (numbers.length === 2 && numbers[0] !== numbers[1]) throw new Error("only uniform SVG scale is supported");
        result = result.compose(new SvgTransform(numbers[0]!));
      }
      remaining = remaining.slice(match[0].length).trimStart();
      if (remaining.startsWith(",")) remaining = remaining.slice(1).trimStart();
    }
    return result;
  }
}

