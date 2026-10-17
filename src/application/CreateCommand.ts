import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class CreateCommand extends EditCommand {
  private readonly params: readonly string[];

  constructor(
    session: EditorSession,
    private readonly type: string,
    private readonly id: string,
    params: readonly string[],
    private readonly parentId?: string,
  ) {
    super(session);
    this.params = [...params];
  }

  protected override apply(): string {
    const shape = this.session.factory.create(this.type, this.id, [...this.params]);
    this.document.add(shape, this.parentId);
    const parent = this.parentId ? ` in g#${this.parentId}` : '';
    return `${shape.tag}#${shape.id} created${parent}`;
  }

  protected override undoMessage(): string {
    return `${this.type}#${this.id} creation undone`;
  }
}
