import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class FrontCommand extends EditCommand {
  constructor(session: EditorSession, private readonly id: string) {
    super(session);
  }

  protected override apply(): string {
    this.document.front(this.id);
    const shape = this.document.find(this.id);
    return `${shape.tag}#${shape.id} moved to front`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    return `${shape.tag}#${shape.id} order restored`;
  }
}
