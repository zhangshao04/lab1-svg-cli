import type { Command } from "../application/Command.js";
import type { EditorSession } from "../application/EditorSession.js";
import { Arguments } from "./Arguments.js";

export class CanvasCommand implements Command {
  constructor(private readonly session: EditorSession, private readonly args: Arguments) {}
  async execute(): Promise<string> {
    const document = this.session.getDocument();
    if (this.args.length() === 0) return `canvas ${document.dimensions()}`;
    this.args.count(2);
    return this.session.resize(this.args.number(0, "width"), this.args.number(1, "height"));
  }
}

