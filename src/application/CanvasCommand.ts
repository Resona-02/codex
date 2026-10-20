import type { Command } from './Command.js';
import type { EditorSession } from './EditorSession.js';

export class CanvasCommand implements Command {
  constructor(private readonly receiver: EditorSession, private readonly width?: number, private readonly height?: number) {}

  execute(): string {
    return this.receiver.canvas(this.width, this.height);
  }
}
