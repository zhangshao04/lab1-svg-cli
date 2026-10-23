export class Tokenizer {
  tokenize(line: string): string[] {
    if (!line.trim() || line.trimStart().startsWith("#")) return [];
    const tokens: string[] = [];
    let token = "", quoted = false, started = false, closed = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index]!;
      if (quoted) {
        if (character === "\\" && ['"', "\\"].includes(line[index + 1] ?? "")) {
          token += line[++index]!;
        } else if (character === '"') {
          quoted = false;
          closed = true;
        } else token += character;
      } else if (/\s/.test(character)) {
        if (started) tokens.push(token);
        token = ""; started = false; closed = false;
      } else {
        if (closed) throw new Error("expected whitespace after quoted argument");
        if (character === '"') {
          if (started) throw new Error("quote must start an argument");
          quoted = true; started = true;
        } else { token += character; started = true; }
      }
    }
    if (quoted) throw new Error("unterminated double quote");
    if (started) tokens.push(token);
    return tokens;
  }
}

