import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class BackCommand extends EditCommand {
  constructor(session: EditorSession, private readonly id: string) {
    super(session);
  }

  protected override apply(): string {
    this.document.back(this.id);
    const shape = this.document.find(this.id);
    return `${shape.tag}#${shape.id} moved to back`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    return `${shape.tag}#${shape.id} order restored`;
  }
}
