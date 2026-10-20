import { EditorSession } from './application/EditorSession.js';
import { SvgFileStore } from './infrastructure/SvgFileStore.js';
import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { CommandFactory } from './cli/CommandFactory.js';
import { Cli } from './cli/Cli.js';

// 唯一的组装入口：应用层仅认识接口，本地文件实现从这里注入。
const session = new EditorSession(new SvgFileStore());
await new Cli(new CommandDispatcher(new CommandFactory(session), session.executor)).run();
