import type { EditCommand } from './EditCommand.js';

/** 只保存命令和迁移两个栈；不调用命令，执行时序由 CommandExecutor 负责。 */
export class History {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private blocked = false;

  get undoCount(): number { return this.undoStack.length; }
  get redoCount(): number { return this.redoStack.length; }

  recordExecuted(command: EditCommand): void {
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.blocked = false;
  }

  peekUndo(): EditCommand {
    this.assertAllowed();
    const command = this.undoStack.at(-1);
    if (!command) throw new Error('nothing to undo');
    return command;
  }

  peekRedo(): EditCommand {
    this.assertAllowed();
    const command = this.redoStack.at(-1);
    if (!command) throw new Error('nothing to redo');
    return command;
  }

  recordUndone(command: EditCommand): void {
    if (this.peekUndo() !== command) throw new Error('undo history changed during execution');
    this.undoStack.pop();
    this.redoStack.push(command);
  }

  recordRedone(command: EditCommand): void {
    if (this.peekRedo() !== command) throw new Error('redo history changed during execution');
    this.redoStack.pop();
    this.undoStack.push(command);
  }

  barrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.blocked = true;
  }

  private assertAllowed(): void {
    if (this.blocked) throw new Error('undo not allowed after io command');
  }
}
