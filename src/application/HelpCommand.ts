import type { Command } from './Command.js';
import type { HelpReceiver } from './HelpReceiver.js';

export class HelpCommand implements Command {
  constructor(private readonly receiver: HelpReceiver) {}

  execute(): string {
    return this.receiver.help();
  }
}
