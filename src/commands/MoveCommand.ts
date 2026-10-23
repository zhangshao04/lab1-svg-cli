import type { EditorSession } from "../application/EditorSession.js";
import { Numbers } from "../domain/Numbers.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { Arguments } from "./Arguments.js";
import { EditCommand } from "./EditCommand.js";

export class MoveCommand extends EditCommand {
  constructor(session: EditorSession, private readonly args: Arguments) { super(session); }
  protected override change(document: SvgDocument): string {
    this.args.count(3);
    const shape = document.find(this.args.value(0));
    const dx = this.args.number(1, "dx"), dy = this.args.number(2, "dy");
    shape.move(dx, dy);
    return `${shape.label()} moved by (${Numbers.format(dx)},${Numbers.format(dy)})`;
  }
}

