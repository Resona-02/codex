import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class AddToCommand extends EditCommand {
  constructor(
    session: EditorSession,
    private readonly groupId: string,
    private readonly id: string,
  ) {
    super(session);
  }

  protected override apply(): string {
    this.document.addTo(this.groupId, this.id);
    const shape = this.document.find(this.id);
    return `${shape.tag}#${shape.id} moved into g#${this.groupId}`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    return `${shape.tag}#${shape.id} parent restored`;
  }
}
