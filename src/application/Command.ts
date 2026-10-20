/** 所有入口共用的请求接口；文件命令允许异步执行。 */
export interface Command {
  execute(): string | Promise<string>;
}
