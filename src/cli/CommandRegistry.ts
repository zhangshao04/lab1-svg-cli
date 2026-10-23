import type { Command } from "../application/Command.js";
import type { EditorSession } from "../application/EditorSession.js";
import { Arguments } from "../commands/Arguments.js";
import { HelpCommand } from "../commands/HelpCommand.js";
import { InitCommand } from "../commands/InitCommand.js";
import { ReadCommand } from "../commands/ReadCommand.js";
import { SaveCommand } from "../commands/SaveCommand.js";
import { CanvasCommand } from "../commands/CanvasCommand.js";
import { CreateCommand } from "../commands/CreateCommand.js";
import { DeleteCommand } from "../commands/DeleteCommand.js";
import { MoveCommand } from "../commands/MoveCommand.js";
import { ScaleCommand } from "../commands/ScaleCommand.js";
import { SetCommand } from "../commands/SetCommand.js";
import { GroupCommand } from "../commands/GroupCommand.js";
import { UngroupCommand } from "../commands/UngroupCommand.js";
import { AddToCommand } from "../commands/AddToCommand.js";
import { FrontCommand } from "../commands/FrontCommand.js";
import { BackCommand } from "../commands/BackCommand.js";
import { TreeCommand } from "../commands/TreeCommand.js";
import { ShowCommand } from "../commands/ShowCommand.js";
import { UndoCommand } from "../commands/UndoCommand.js";
import { RedoCommand } from "../commands/RedoCommand.js";

export class CommandRegistry {
  // Second name-dispatch point. TODO (plugin phase): external command providers.
  private readonly commands: Map<string, { create: (args: Arguments) => Command; syntax: string }>;

  constructor(session: EditorSession) {
    this.commands = new Map([
      ["init", { create: args => new InitCommand(session, args), syntax: "init [w] [h] — new canvas (default 800x600)" }],
      ["read", { create: args => new ReadCommand(session, args), syntax: "read <file.svg> — load SVG; assign missing IDs" }],
      ["save", { create: args => new SaveCommand(session, args), syntax: "save [file.svg] — save to explicit or remembered path" }],
      ["canvas", { create: args => new CanvasCommand(session, args), syntax: "canvas [w h] — show or resize canvas" }],
      ["create", { create: args => new CreateCommand(session, args), syntax: "create <type> <id> [params...] [in <containerId>]" }],
      ["delete", { create: args => new DeleteCommand(session, args), syntax: "delete <id> — remove shape and descendants" }],
      ["move", { create: args => new MoveCommand(session, args), syntax: "move <id> <dx> <dy> — translate shape or group" }],
      ["scale", { create: args => new ScaleCommand(session, args), syntax: "scale <id> <factor> — scale positions and dimensions" }],
      ["set", { create: args => new SetCommand(session, args), syntax: "set <id> <attr> <value> — edit allowed attributes" }],
      ["group", { create: args => new GroupCommand(session, args), syntax: "group <newGid> <id1> [id2...] — group existing shapes" }],
      ["ungroup", { create: args => new UngroupCommand(session, args), syntax: "ungroup <gid> — dissolve a non-top-level group" }],
      ["addto", { create: args => new AddToCommand(session, args), syntax: "addto <gid> <id> — reparent an existing shape" }],
      ["front", { create: args => new FrontCommand(session, args), syntax: "front <id> — bring to front among siblings" }],
      ["back", { create: args => new BackCommand(session, args), syntax: "back <id> — send to back among siblings" }],
      ["tree", { create: args => new TreeCommand(session, args), syntax: "tree [id] — display structure and geometry" }],
      ["show", { create: args => new ShowCommand(session, args), syntax: "show <id> — display attributes and parent" }],
      ["undo", { create: args => new UndoCommand(session, args), syntax: "undo — undo one edit" }],
      ["redo", { create: args => new RedoCommand(session, args), syntax: "redo — redo one edit" }],
      ["help", { create: args => new HelpCommand(args, this.help()), syntax: "help — show command syntax" }],
    ]);
  }

  create(tokens: readonly string[]): Command {
    const definition = this.commands.get(tokens[0] ?? "");
    if (!definition) throw new Error(`unknown command: ${tokens[0] ?? ""}`);
    return definition.create(new Arguments(tokens.slice(1)));
  }

  private help(): string {
    return [...this.commands.values()].map(command => command.syntax).join("\n") +
      "\n\nShape parameters:\n" +
      "  rect <id> <x> <y> <w> <h> [fill]\n" +
      "  circle <id> <cx> <cy> <r> [fill]\n" +
      "  ellipse <id> <cx> <cy> <rx> <ry> [fill]\n" +
      "  line <id> <x1> <y1> <x2> <y2> [stroke]\n" +
      '  text <id> <x> <y> "content"\n' +
      "  g <id>\n" +
      "All create commands accept: in <containerId>\n" +
      "set: fill, stroke, stroke-width; type-specific geometry; text content via text\n" +
      "Whole lines starting with # are comments. Use double quotes for spaces.\n" +
      "init/read/save/canvas resize block undo/redo until the next successful edit.\n" +
      "End input with Ctrl+D (Unix) or Ctrl+Z then Enter (Windows).";
  }
}

