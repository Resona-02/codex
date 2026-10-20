import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class CreateCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly type: string, private readonly id: string,
    private readonly params: readonly string[], private readonly parentId?: string) {
    super(receiver);
    this.params = [...params];
  }

  override execute(): string {
    return this.receiver.create(this.state, this.type, this.id, this.params, this.parentId);
  }
}
