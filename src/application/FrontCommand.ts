import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class FrontCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string) {
    super(receiver);
  }

  override execute(): string {
    return this.receiver.front(this.state, this.id);
  }
}
