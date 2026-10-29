import { SvgDocument } from "../domain/SvgDocument.js";
import type { DocumentStore } from "./DocumentStore.js";
import { History } from "./History.js";

export class EditorSession {
  private document: SvgDocument | undefined;
  private readPath: string | undefined;
  private lastSavedPath: string | undefined;
  private readonly history = new History();

  constructor(private readonly store: DocumentStore) {}
  getHistory(): History { return this.history; }

  getDocument(): SvgDocument {
    if (!this.document) throw new Error("no document. use 'init' or 'read' first");
    return this.document;
  }

  replaceDocument(document: SvgDocument): void { this.document = document; }

  init(width = 800, height = 600): string {
    const document = new SvgDocument(width, height);
    this.document = document;
    this.readPath = undefined;
    this.lastSavedPath = undefined;
    this.history.barrier();
    return `canvas ${document.dimensions()} created`;
  }

  async read(path: string): Promise<string> {
    const loaded = await this.store.read(path);
    this.document = loaded.document;
    this.readPath = path;
    this.lastSavedPath = undefined;
    this.history.barrier();
    return [...loaded.warnings, `read ${path} (${loaded.document.size()} elements)`].join("\n");
  }

  async save(path?: string): Promise<string> {
    const document = this.getDocument();
    // Saving a copy must not replace the destination established by read.
    const destination = path ?? this.readPath ?? this.lastSavedPath;
    if (!destination) throw new Error("no file path. use 'save <file.svg>'");
    await this.store.write(destination, document);
    this.lastSavedPath = destination;
    this.history.barrier();
    return `saved to ${destination} (${document.size()} elements)`;
  }

  resize(width: number, height: number): string {
    const document = this.getDocument().clone();
    document.resize(width, height);
    this.document = document;
    this.history.barrier();
    return `canvas resized to ${document.dimensions()}`;
  }
}

