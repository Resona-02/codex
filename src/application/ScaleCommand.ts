import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class ScaleCommand extends EditCommand {
  constructor(
    session: EditorSession,
    private readonly id: string,
    private readonly factor: number,
  ) {
    super(session);
  }

  protected override apply(): string {
    const shape = this.document.find(this.id);
    shape.scale(this.factor);
    return `${shape.summary()} scaled by ${this.factor}`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    return `${shape.summary()} scale undone`;
  }
}
