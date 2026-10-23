import type { EditorSession } from "../application/EditorSession.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { Arguments } from "./Arguments.js";
import { EditCommand } from "./EditCommand.js";

export class SetCommand extends EditCommand {
  constructor(session: EditorSession, private readonly args: Arguments) { super(session); }
  protected override change(document: SvgDocument): string {
    this.args.count(3);
    const shape = document.find(this.args.value(0));
    shape.setAttribute(this.args.value(1), this.args.value(2));
    return `${shape.label()} updated: ${this.args.value(1)}=${JSON.stringify(this.args.value(2))}`;
  }
}

