import type { Command } from '../application/Command.js';

export interface CommandSource {
  parse(line: string): Command | undefined;
}
