import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class GroupCommand extends EditCommand {
  private readonly ids: readonly string[];

  constructor(session: EditorSession, private readonly newId: string, ids: readonly string[]) {
    super(session);
    this.ids = [...ids];
  }

  protected override apply(): string {
    this.document.group(this.newId, [...this.ids]);
    return `g#${this.newId} created with ${this.ids.length} children`;
  }

  protected override undoMessage(): string {
    return `g#${this.newId} grouping undone`;
  }
}
