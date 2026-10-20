import type { Command } from './Command.js';
import { EditCommand } from './EditCommand.js';
import { History } from './History.js';

/** 统一 Invoker。所有命令经过这里，只有可撤销的编辑命令进入历史。 */
export class CommandExecutor {
  constructor(private readonly history = new History()) {}

  executeCommand(command: EditCommand): string;
  executeCommand(command: Command): string | Promise<string>;
  executeCommand(command: Command): string | Promise<string> {
    return command instanceof EditCommand ? this.history.execute(command) : command.execute();
  }
}
