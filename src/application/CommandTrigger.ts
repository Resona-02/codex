import type { Command } from './Command.js';
import type { CommandExecutor } from './CommandExecutor.js';

/** 可供菜单、右键菜单、工具栏等入口复用的触发器；不认识接收者。 */
export class CommandTrigger {
  constructor(private readonly command: Command, private readonly executor: CommandExecutor) {}

  run(): string | Promise<string> {
    return this.executor.executeCommand(this.command);
  }
}
