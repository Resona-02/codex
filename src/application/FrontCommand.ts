import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class FrontCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string) {
    super(receiver);
  }

  override newExecution(): FrontCommand {
    return new FrontCommand(this.receiver, this.id);
  }

  override execute(): string {
    return this.receiver.front(this.state, this.id);
  }
}
