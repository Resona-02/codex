import type { Token } from './Token.js';

/** 参数校验集中在边界；领域模型仍会校验业务不变量。 */
export class CommandArguments {
  constructor(private readonly tokens: readonly Token[], private readonly syntax: string) {}

  get length(): number { return this.tokens.length; }

  expect(minimum: number, maximum = minimum): void {
    if (this.length < minimum || this.length > maximum) this.invalidUsage();
  }

  invalidUsage(): never { throw new Error(`usage: ${this.syntax}`); }

  string(index: number): string {
    if (!this.tokens[index]) this.invalidUsage();
    return this.tokens[index].value;
  }

  number(index: number): number {
    const value = this.string(index);
    const number = Number(value);
    if (!value.trim() || !Number.isFinite(number) || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
      throw new Error(`invalid number: ${value}`);
    }
    return number;
  }

  strings(start = 0): string[] { return this.tokens.slice(start).map(token => token.value); }

  creation(): { arguments: CommandArguments; parentId?: string } {
    const suffix = this.tokens[this.length - 2];
    if (suffix?.value === 'in' && !suffix.quoted) {
      return {
        arguments: new CommandArguments(this.tokens.slice(0, -2), this.syntax),
        parentId: this.string(this.length - 1),
      };
    }
    return { arguments: this };
  }
}
