import type { Command } from './Command.js';

export class HelpCommand implements Command {
  constructor(private readonly receiver: { help(): string }) {}

  execute(): string {
    return this.receiver.help();
  }
}
