import type { Command } from './Command.js';
import { EditCommand } from './EditCommand.js';
import { History } from './History.js';

/** Invoker：统一调用命令；命令成功后才提交栈迁移，失败保留原有历史。 */
export class CommandExecutor {
  constructor(private readonly history = new History()) {}

  executeCommand(command: EditCommand): string;
  executeCommand(command: Command): string | Promise<string>;
  executeCommand(command: Command): string | Promise<string> {
    const result = command.execute();
    if (command instanceof EditCommand) this.history.recordExecuted(command);
    return result;
  }

  undo(): string {
    const command = this.history.peekUndo();
    const result = command.undo();
    this.history.recordUndone(command);
    return result;
  }

  redo(): string {
    const command = this.history.peekRedo();
    const result = command.execute();
    this.history.recordRedone(command);
    return result;
  }
}
