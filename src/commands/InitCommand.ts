import type { Command } from "../application/Command.js";
import type { EditorSession } from "../application/EditorSession.js";
import { Arguments } from "./Arguments.js";

export class InitCommand implements Command {
  constructor(private readonly session: EditorSession, private readonly args: Arguments) {}
  async execute(): Promise<string> {
    this.args.count(0, 2);
    return this.session.init(this.args.length() > 0 ? this.args.number(0, "width") : 800,
      this.args.length() > 1 ? this.args.number(1, "height") : 600);
  }
}

