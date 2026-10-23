export interface ReversibleCommand {
  apply(): string;
  undo(): string;
  redo(): string;
}

