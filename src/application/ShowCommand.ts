import type { Command } from './Command.js';
import type { ViewReceiver } from './ViewReceiver.js';

export class ShowCommand implements Command {
  constructor(private readonly receiver: ViewReceiver, private readonly id: string) {}

  execute(): string {
    return this.receiver.show(this.id);
  }
}
