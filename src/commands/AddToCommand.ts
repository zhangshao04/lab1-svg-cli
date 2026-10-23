import type { EditorSession } from "../application/EditorSession.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { Arguments } from "./Arguments.js";
import { EditCommand } from "./EditCommand.js";

export class AddToCommand extends EditCommand {
  constructor(session: EditorSession, private readonly args: Arguments) { super(session); }
  protected override change(document: SvgDocument): string {
    this.args.count(2); return document.addTo(this.args.value(0), this.args.value(1));
  }
}

