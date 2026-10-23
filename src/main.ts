import { createReadStream } from "node:fs";
import { EditorSession } from "./application/EditorSession.js";
import { CommandProcessor } from "./cli/CommandProcessor.js";
import { Repl } from "./cli/Repl.js";
import { FileDocumentStore } from "./infrastructure/FileDocumentStore.js";

const args = process.argv.slice(2);
if (args.length !== 0 && !(args.length === 2 && args[0] === "--script")) {
  process.stderr.write("usage: npm run cli -- [--script <commands.txt>]\n");
  process.exitCode = 1;
} else {
  const input = args.length === 2 ? createReadStream(args[1]!, { encoding: "utf8" }) : process.stdin;
  const processor = new CommandProcessor(new EditorSession(new FileDocumentStore()));
  const interactive = args.length === 0 && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  try {
    const success = await new Repl(processor, input, process.stdout, interactive, args.length === 2).run();
    if (!success && !interactive) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message.replace(/[\r\n]+/g, " ")}\n`);
    process.exitCode = 1;
  }
}

