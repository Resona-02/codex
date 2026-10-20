/** 单条编辑的局部撤销记录。没有文档副本，也不保存执行后状态。 */
export class UndoState {
  private readonly restorations: (() => void)[] = [];
  private message?: () => string;

  record(restore: () => void): void {
    this.restorations.push(restore);
  }

  run(action: () => string, message: () => string): string {
    if (this.message) throw new Error('command already executed');
    try {
      const result = action();
      this.message = message;
      return result;
    } catch (error) {
      this.restore();
      throw error;
    }
  }

  undo(): string {
    if (!this.message) throw new Error('command has not been executed');
    const message = this.message;
    this.restore();
    this.message = undefined;
    return message();
  }

  private restore(): void {
    for (let index = this.restorations.length - 1; index >= 0; index--) {
      this.restorations[index]!();
    }
    this.restorations.length = 0;
  }
}
