import type { DocumentStore, LoadedDocument } from "../src/application/DocumentStore.js";
import type { SvgDocument } from "../src/domain/SvgDocument.js";

export class MemoryDocumentStore implements DocumentStore {
  private readonly documents = new Map<string, SvgDocument>();

  async read(path: string): Promise<LoadedDocument> {
    const document = this.documents.get(path);
    if (!document) throw new Error(`cannot read file: ${path}`);
    return { document: document.clone(), warnings: [] };
  }

  async write(path: string, document: SvgDocument): Promise<void> {
    if (path === "unwritable.svg") throw new Error(`cannot write file: ${path}`);
    this.documents.set(path, document.clone());
  }
}

