import type { SvgDocument } from '../domain/SvgDocument.js';
import type { EditorSession } from './EditorSession.js';

/**
 * Command 的模板方法：子类表达操作，基类统一保证原子性和撤销粒度。
 * 快照保留整棵 Composite 树，复杂分组也只占一个历史单元。
 */
export abstract class EditCommand {
  private before?: SvgDocument;
  private after?: SvgDocument;
  private result = '';

  constructor(protected readonly session: EditorSession) {}

  protected get document(): SvgDocument {
    return this.session.document;
  }

  execute(): string {
    if (this.after) throw new Error('command already executed');
    const before = this.document.clone();
    try {
      const result = this.apply();
      const after = this.document.clone();
      this.before = before;
      this.after = after;
      this.result = result;
      return result;
    } catch (error) {
      this.session.replaceDocument(before);
      throw error;
    }
  }

  undo(): string {
    if (!this.before) throw new Error('command has not been executed');
    this.session.replaceDocument(this.before.clone());
    return this.undoMessage();
  }

  redo(): string {
    if (!this.after) throw new Error('command has not been executed');
    this.session.replaceDocument(this.after.clone());
    return this.result;
  }

  protected abstract apply(): string;
  protected abstract undoMessage(): string;
}
