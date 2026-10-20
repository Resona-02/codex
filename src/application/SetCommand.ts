import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class SetCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string, private readonly attribute: string, private readonly value: string) {
    super(receiver);
  }

  override execute(): string {
    return this.receiver.set(this.state, this.id, this.attribute, this.value);
  }
}
