import type { EditorSession } from "../application/EditorSession.js";
import { CommandRegistry } from "./CommandRegistry.js";
import { Tokenizer } from "./Tokenizer.js";

export class CommandProcessor {
  private readonly tokenizer = new Tokenizer();
  private readonly registry: CommandRegistry;

  constructor(session: EditorSession) { this.registry = new CommandRegistry(session); }

  async run(line: string): Promise<string> {
    try {
      const tokens = this.tokenizer.tokenize(line);
      if (tokens.length === 0) return "";
      return await this.registry.create(tokens).execute();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `error: ${message.replace(/[\r\n]+/g, " ")}`;
    }
  }
}

