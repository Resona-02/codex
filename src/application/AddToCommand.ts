import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class AddToCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly groupId: string, private readonly id: string) {
    super(receiver);
  }

  override execute(): string {
    return this.receiver.addTo(this.state, this.groupId, this.id);
  }
}
