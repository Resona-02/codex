import type { EditCommand } from './EditCommand.js';

/** 执行器使用的命令栈：成功后才迁移记录，失败时保留两个栈。 */
export class History {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private blocked = false;

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  execute(command: EditCommand): string {
    const result = command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.blocked = false;
    return result;
  }

  undo(): string {
    this.assertAllowed();
    const command = this.undoStack.at(-1);
    if (!command) throw new Error('nothing to undo');
    const result = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return result;
  }

  redo(): string {
    this.assertAllowed();
    const command = this.redoStack.at(-1);
    if (!command) throw new Error('nothing to redo');
    const result = command.execute();
    this.redoStack.pop();
    this.undoStack.push(command);
    return result;
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
