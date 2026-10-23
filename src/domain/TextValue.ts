export class TextValue {
  static validate(value: string): string {
    for (const character of value) {
      const point = character.codePointAt(0)!;
      if (!(point === 9 || point === 10 || point === 13 ||
        (point >= 0x20 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) ||
        (point >= 0x10000 && point <= 0x10ffff))) {
        throw new Error("text contains a character that SVG cannot represent");
      }
    }
    return value;
  }
}
