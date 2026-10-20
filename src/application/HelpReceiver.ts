/** 帮助展示的接收者：只保存命令说明，不引用创建命令的 Client。 */
export class HelpReceiver {
  private readonly syntaxes: readonly string[];

  constructor(syntaxes: readonly string[]) {
    this.syntaxes = [...syntaxes];
  }

  help(): string {
    return this.syntaxes.join('\n');
  }
}
