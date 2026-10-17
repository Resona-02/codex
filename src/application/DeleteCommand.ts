import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class DeleteCommand extends EditCommand {
  constructor(session: EditorSession, private readonly id: string) {
    super(session);
  }

  protected override apply(): string {
    const shape = this.document.find(this.id);
    const label = `${shape.tag}#${shape.id}`;
    this.document.delete(this.id);
    return `${label} deleted`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    const parent = shape.parent && shape.parent !== this.document.root ? `g#${shape.parent.id}` : 'svg';
    return `${shape.tag}#${shape.id} restored into ${parent}`;
  }
}
