import type { SvgDocument } from "../domain/SvgDocument.js";

export interface LoadedDocument {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}

export interface DocumentStore {
  read(path: string): Promise<LoadedDocument>;
  write(path: string, document: SvgDocument): Promise<void>;
}

