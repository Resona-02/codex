import type { Command } from './Command.js';
import type { EditorSession } from './EditorSession.js';

export class SaveCommand implements Command {
  constructor(private readonly receiver: EditorSession, private readonly path?: string) {}

  execute(): Promise<string> {
    return this.receiver.save(this.path);
  }
}
