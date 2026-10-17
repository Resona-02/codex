import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class MoveCommand extends EditCommand {
  constructor(
    session: EditorSession,
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super(session);
  }

  protected override apply(): string {
    const shape = this.document.find(this.id);
    shape.move(this.dx, this.dy);
    return `${shape.summary()} moved by (${this.dx},${this.dy})`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    return `${shape.summary()} moved back by (${-this.dx},${-this.dy})`;
  }
}
