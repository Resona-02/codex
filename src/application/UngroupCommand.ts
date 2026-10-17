import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class UngroupCommand extends EditCommand {
  constructor(session: EditorSession, private readonly id: string) {
    super(session);
  }

  protected override apply(): string {
    this.document.ungroup(this.id);
    return `g#${this.id} ungrouped`;
  }

  protected override undoMessage(): string {
    return `g#${this.id} restored`;
  }
}
