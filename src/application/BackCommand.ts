import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class BackCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string) {
    super(receiver);
  }

  override newExecution(): BackCommand {
    return new BackCommand(this.receiver, this.id);
  }

  override execute(): string {
    return this.receiver.back(this.state, this.id);
  }
}
