import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class ScaleCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string, private readonly factor: number) {
    super(receiver);
  }

  override newExecution(): ScaleCommand {
    return new ScaleCommand(this.receiver, this.id, this.factor);
  }

  override execute(): string {
    return this.receiver.scale(this.state, this.id, this.factor);
  }
}
