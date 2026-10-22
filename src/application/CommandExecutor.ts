import type { Command } from './Command.js';
import { EditCommand } from './EditCommand.js';
import { History } from './History.js';

/** Invoker：统一执行与历史迁移；异步命令等待期间拒绝其他入口，结束后可重试。 */
export class CommandExecutor {
  private pending = false;
  private readonly executed = new WeakSet<EditCommand>();

  constructor(private readonly history = new History()) {}

  executeCommand(command: EditCommand): string;
  executeCommand(command: Command): string | Promise<string>;
  executeCommand(command: Command): string | Promise<string> {
    this.assertIdle();
    // 每次新的编辑使用独立状态；redo 则直接重执行历史中的原实例。
    const execution = command instanceof EditCommand && this.executed.has(command)
      ? command.newExecution() : command;
    const result = execution.execute();
    if (execution instanceof EditCommand) {
      this.history.recordExecuted(execution);
      this.executed.add(execution);
    }
    if (typeof result !== 'string') {
      this.pending = true;
      return result.finally(() => { this.pending = false; });
    }
    return result;
  }

  undo(): string {
    this.assertIdle();
    const command = this.history.peekUndo();
    const result = command.undo();
    this.history.recordUndone(command);
    return result;
  }

  redo(): string {
    this.assertIdle();
    const command = this.history.peekRedo();
    const result = command.execute();
    this.history.recordRedone(command);
    return result;
  }

  private assertIdle(): void {
    if (this.pending) throw new Error('command in progress. wait for it to finish and retry');
  }
}
