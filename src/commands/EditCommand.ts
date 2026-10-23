import type { Command } from "../application/Command.js";
import type { EditorSession } from "../application/EditorSession.js";
import type { ReversibleCommand } from "../application/ReversibleCommand.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export abstract class EditCommand implements Command, ReversibleCommand {
  private before: SvgDocument | undefined;
  private after: SvgDocument | undefined;
  private message = "";

  protected constructor(protected readonly session: EditorSession) {}
  protected abstract change(document: SvgDocument): string;

  async execute(): Promise<string> { return this.session.getHistory().execute(this); }

  apply(): string {
    const before = this.session.getDocument().clone();
    const candidate = before.clone();
    const message = this.change(candidate);
    // No live state or history changes until every validation and edit succeeds.
    this.before = before;
    this.after = candidate.clone();
    this.message = message;
    this.session.replaceDocument(candidate);
    return message;
  }

  undo(): string {
    if (!this.before) throw new Error("command has not executed");
    this.session.replaceDocument(this.before.clone());
    return `undone: ${this.message}`;
  }

  redo(): string {
    if (!this.after) throw new Error("command has not executed");
    this.session.replaceDocument(this.after.clone());
    return `redone: ${this.message}`;
  }
}

