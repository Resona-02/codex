import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { CommandDispatcher } from './CommandDispatcher.js';

/** 支持交互终端，也支持通过标准输入回放命令文件。EOF 结束会话。 */
export class Cli {
  constructor(
    private readonly dispatcher: CommandDispatcher,
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout,
  ) {}

  async run(): Promise<void> {
    const interactive = this.input === process.stdin && Boolean(process.stdin.isTTY) && this.output === process.stdout;
    const reader = createInterface({ input: this.input, output: this.output, terminal: interactive });
    if (interactive) {
      this.output.write("svg-editor 0.1 — type 'help' for commands\n");
      reader.setPrompt('svg> ');
      reader.prompt();
    }
    for await (const line of reader) {
      const result = await this.dispatcher.execute(line);
      if (result) this.output.write(`${result}\n`);
      if (interactive) reader.prompt();
    }
  }
}
