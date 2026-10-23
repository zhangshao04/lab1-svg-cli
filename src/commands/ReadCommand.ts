import type { Command } from "../application/Command.js";
import type { EditorSession } from "../application/EditorSession.js";
import { Arguments } from "./Arguments.js";

export class ReadCommand implements Command {
  constructor(private readonly session: EditorSession, private readonly args: Arguments) {}
  async execute(): Promise<string> {
    this.args.count(1, 1);
    return this.session.read(this.args.value(0));
  }
}

