import type { Command } from "../application/Command.js";
import type { EditorSession } from "../application/EditorSession.js";
import { Arguments } from "./Arguments.js";

export class UndoCommand implements Command {
  constructor(private readonly session: EditorSession, private readonly args: Arguments) {}
  async execute(): Promise<string> {
    this.args.count(0, 0);
    this.session.getDocument(); return this.session.getHistory().undo();
  }
}

