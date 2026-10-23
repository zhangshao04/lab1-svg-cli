import type { Command } from "../application/Command.js";
import { Arguments } from "./Arguments.js";

export class HelpCommand implements Command {
  constructor(private readonly args: Arguments, private readonly text: string) {}
  async execute(): Promise<string> { this.args.count(0); return this.text; }
}

