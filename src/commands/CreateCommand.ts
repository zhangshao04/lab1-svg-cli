import type { EditorSession } from "../application/EditorSession.js";
import { ShapeFactory } from "../domain/ShapeFactory.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { Arguments } from "./Arguments.js";
import { EditCommand } from "./EditCommand.js";

export class CreateCommand extends EditCommand {
  constructor(session: EditorSession, private readonly args: Arguments) { super(session); }

  protected override change(document: SvgDocument): string {
    this.args.count(2, Number.POSITIVE_INFINITY);
    const values = [...this.args.values()];
    let parent: string | undefined;
    if (values.length >= 4 && values.at(-2) === "in") {
      parent = values.pop()!;
      values.pop();
    }
    const [type, id, ...parameters] = values;
    const shape = new ShapeFactory().create(type!, id!, parameters);
    document.add(shape, parent);
    return `${shape.label()} created${parent === undefined ? "" : ` in g#${parent}`}`;
  }
}

