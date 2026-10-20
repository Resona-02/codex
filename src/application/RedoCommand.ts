import type { Command } from './Command.js';
import type { EditorSession } from './EditorSession.js';

export class RedoCommand implements Command {
  constructor(private readonly receiver: EditorSession) {}

  execute(): string {
    return this.receiver.redo();
  }
}
