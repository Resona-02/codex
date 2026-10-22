import { EditCommand } from './EditCommand.js';
import type { EditReceiver } from './EditReceiver.js';

export class MoveCommand extends EditCommand {
  constructor(receiver: EditReceiver, private readonly id: string, private readonly dx: number, private readonly dy: number) {
    super(receiver);
  }

  override newExecution(): MoveCommand {
    return new MoveCommand(this.receiver, this.id, this.dx, this.dy);
  }

  override execute(): string {
    return this.receiver.move(this.state, this.id, this.dx, this.dy);
  }
}
