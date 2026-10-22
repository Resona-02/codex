import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class GroupCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly newId: string, private readonly ids: readonly string[]) {
    super(receiver);
    this.ids = [...ids];
  }

  override newExecution(): GroupCommand {
    return new GroupCommand(this.receiver, this.newId, this.ids);
  }

  override execute(): string {
    return this.receiver.group(this.state, this.newId, this.ids);
  }
}
