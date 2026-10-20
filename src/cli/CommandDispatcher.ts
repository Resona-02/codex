import type { CommandSource } from './CommandSource.js';
import type { CommandExecutor } from '../application/CommandExecutor.js';

/** CLI 入口：取得抽象命令、委托执行器、格式化错误，不接触业务接收者。 */
export class CommandDispatcher {
  constructor(private readonly source: CommandSource, private readonly executor: CommandExecutor) {}

  async execute(line: string): Promise<string> {
    try {
      const command = this.source.parse(line);
      return command ? await this.executor.executeCommand(command) : '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `error: ${message.replace(/[\r\n]+/g, ' ')}`;
    }
  }
}
