import type { Command } from './Command.js';
import type { EditorSession } from './EditorSession.js';

export class InitCommand implements Command {
  constructor(private readonly receiver: EditorSession, private readonly width = 800, private readonly height = 600) {}

  execute(): Promise<string> {
    return this.receiver.init(this.width, this.height);
  }
}
