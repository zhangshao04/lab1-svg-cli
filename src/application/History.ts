import type { ReversibleCommand } from "./ReversibleCommand.js";

export class History {
  private readonly undoStack: ReversibleCommand[] = [];
  private readonly redoStack: ReversibleCommand[] = [];
  private blocked = true;

  execute(command: ReversibleCommand): string {
    const message = command.apply();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.blocked = false;
    return message;
  }

  barrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.blocked = true;
  }

  undo(): string {
    this.ensureAllowed();
    const command = this.undoStack.at(-1);
    if (!command) throw new Error("nothing to undo");
    const message = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return message;
  }

  redo(): string {
    this.ensureAllowed();
    const command = this.redoStack.at(-1);
    if (!command) throw new Error("nothing to redo");
    const message = command.redo();
    this.redoStack.pop();
    this.undoStack.push(command);
    return message;
  }

  private ensureAllowed(): void {
    if (this.blocked) throw new Error("undo not allowed after io command");
  }
}

