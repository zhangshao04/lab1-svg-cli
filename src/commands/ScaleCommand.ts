import type { EditorSession } from "../application/EditorSession.js";
import { Numbers } from "../domain/Numbers.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { Arguments } from "./Arguments.js";
import { EditCommand } from "./EditCommand.js";

export class ScaleCommand extends EditCommand {
  constructor(session: EditorSession, private readonly args: Arguments) { super(session); }
  protected override change(document: SvgDocument): string {
    this.args.count(2);
    const shape = document.find(this.args.value(0));
    const factor = this.args.number(1, "scale factor");
    shape.scale(factor);
    return `${shape.label()} scaled by ${Numbers.format(factor)}`;
  }
}

