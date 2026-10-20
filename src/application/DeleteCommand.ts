import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class DeleteCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string) {
    super(receiver);
  }

  override execute(): string {
    return this.receiver.delete(this.state, this.id);
  }
}
