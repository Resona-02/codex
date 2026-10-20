import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class UngroupCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string) {
    super(receiver);
  }

  override execute(): string {
    return this.receiver.ungroup(this.state, this.id);
  }
}
