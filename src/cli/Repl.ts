import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { CommandProcessor } from "./CommandProcessor.js";

export class Repl {
  constructor(
    private readonly processor: CommandProcessor,
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly interactive: boolean,
    private readonly echo = false,
  ) {}

  async run(): Promise<boolean> {
    const lines = createInterface({ input: this.input, crlfDelay: Infinity,
      ...(this.interactive ? { output: this.output, terminal: true, prompt: "svg> " } : {}) });
    this.output.write("svg-editor 0.1 — type 'help' for commands\n");
    if (this.interactive) lines.prompt();
    let success = true;
    try {
      for await (const line of lines) {
        if (this.echo && line.trim() && !line.trimStart().startsWith("#")) this.output.write(`svg> ${line}\n`);
        const result = await this.processor.run(line);
        if (result) this.output.write(result + "\n");
        if (result.startsWith("error:")) success = false;
        if (this.interactive) lines.prompt();
      }
    } finally { lines.close(); }
    return success;
  }
}

