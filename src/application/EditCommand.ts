import type { Command } from './Command.js';
import type { EditReceiver } from './EditReceiver.js';
import { UndoState } from './UndoState.js';

/** 命令只绑定接收者和请求参数。旧状态由接收者填写，命令不解释它。 */
export abstract class EditCommand implements Command {
  protected readonly state = new UndoState();

  constructor(protected readonly receiver: EditReceiver) {}

  abstract execute(): string;

  undo(): string {
    return this.receiver.undo(this.state);
  }
}
