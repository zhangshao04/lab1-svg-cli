export class Numbers {
  static parse(value: string, label = "number"): number {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
      throw new Error(`invalid ${label}: ${value}`);
    }
    return this.finite(Number(value), label);
  }

  static finite(value: number, label = "number"): number {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return Object.is(value, -0) ? 0 : value;
  }

  static nonNegative(value: number, label: string): number {
    this.finite(value, label);
    if (value < 0) throw new Error(`${label} must be non-negative`);
    return value;
  }

  static positive(value: number, label: string): number {
    this.finite(value, label);
    if (value <= 0) throw new Error(`${label} must be positive`);
    return value;
  }

  static format(value: number): string {
    return String(Object.is(value, -0) ? 0 : Number(value.toPrecision(14)));
  }
}

