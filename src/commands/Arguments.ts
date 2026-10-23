import { Numbers } from "../domain/Numbers.js";

export class Arguments {
  constructor(private readonly tokens: readonly string[]) {}
  length(): number { return this.tokens.length; }
  values(): readonly string[] { return [...this.tokens]; }

  value(index: number): string {
    const value = this.tokens[index];
    if (value === undefined) throw new Error("missing argument");
    return value;
  }

  optional(index: number): string | undefined { return this.tokens[index]; }
  number(index: number, label: string): number { return Numbers.parse(this.value(index), label); }

  count(min: number, max = min): void {
    if (this.tokens.length < min || this.tokens.length > max) {
      throw new Error(`expected ${min === max ? min : `${min}..${max}`} arguments, got ${this.tokens.length}`);
    }
  }
}

