import { EditCommand } from './EditCommand.js';
import type { EditorSession } from './EditorSession.js';

export class SetCommand extends EditCommand {
  constructor(
    session: EditorSession,
    private readonly id: string,
    private readonly attribute: string,
    private readonly value: string,
  ) {
    super(session);
  }

  protected override apply(): string {
    const shape = this.document.find(this.id);
    shape.setAttribute(this.attribute, this.value);
    return `${shape.tag}#${shape.id} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }

  protected override undoMessage(): string {
    const shape = this.document.find(this.id);
    const value = this.attribute === 'text' ? shape.text : shape.attributes()[this.attribute];
    return `${shape.tag}#${shape.id} updated: ${this.attribute}=${value === undefined ? '(unset)' : JSON.stringify(value)}`;
  }
}
