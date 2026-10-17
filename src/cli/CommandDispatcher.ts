import { EditorSession } from '../application/EditorSession.js';
import { CreateCommand } from '../application/CreateCommand.js';
import { DeleteCommand } from '../application/DeleteCommand.js';
import { MoveCommand } from '../application/MoveCommand.js';
import { ScaleCommand } from '../application/ScaleCommand.js';
import { SetCommand } from '../application/SetCommand.js';
import { GroupCommand } from '../application/GroupCommand.js';
import { UngroupCommand } from '../application/UngroupCommand.js';
import { AddToCommand } from '../application/AddToCommand.js';
import { FrontCommand } from '../application/FrontCommand.js';
import { BackCommand } from '../application/BackCommand.js';
import { Tokenizer } from './Tokenizer.js';
import { CommandArguments } from './CommandArguments.js';
import { TreeView } from './TreeView.js';

interface CommandEntry {
  readonly syntax: string;
  readonly run: (arguments_: CommandArguments) => string | Promise<string>;
}

/** 唯一的命令名注册点。这里只解析参数，编辑行为在独立 Command 类中。 */
export class CommandDispatcher {
  private readonly entries = new Map<string, CommandEntry>();
  private readonly tokenizer = new Tokenizer();
  private readonly view = new TreeView();

  constructor(private readonly session: EditorSession) {
    this.register('init', 'init [w] [h]', args => {
      args.expect(0, 2);
      return session.init(args.length > 0 ? args.number(0) : 800, args.length > 1 ? args.number(1) : 600);
    });
    this.register('read', 'read <file.svg>', args => {
      args.expect(1);
      return session.read(args.string(0));
    });
    this.register('save', 'save [file.svg]', args => {
      args.expect(0, 1);
      return session.save(args.length ? args.string(0) : undefined);
    });
    this.register('canvas', 'canvas [w] [h]', args => {
      args.expect(0, 2);
      if (args.length === 1) args.invalidUsage();
      return args.length ? session.canvas(args.number(0), args.number(1)) : session.canvas();
    });
    this.register('create', 'create <type> <id> [params...] [in <containerId>]', args => {
      const { arguments: values, parentId } = args.creation();
      values.expect(2, Number.POSITIVE_INFINITY);
      return session.execute(new CreateCommand(session, values.string(0), values.string(1), values.strings(2), parentId));
    });
    this.register('delete', 'delete <id>', args => {
      args.expect(1);
      return session.execute(new DeleteCommand(session, args.string(0)));
    });
    this.register('move', 'move <id> <dx> <dy>', args => {
      args.expect(3);
      return session.execute(new MoveCommand(session, args.string(0), args.number(1), args.number(2)));
    });
    this.register('scale', 'scale <id> <factor>', args => {
      args.expect(2);
      return session.execute(new ScaleCommand(session, args.string(0), args.number(1)));
    });
    this.register('set', 'set <id> <attr> <value>', args => {
      args.expect(3);
      return session.execute(new SetCommand(session, args.string(0), args.string(1), args.string(2)));
    });
    this.register('group', 'group <newGid> <id1> [id2...]', args => {
      args.expect(2, Number.POSITIVE_INFINITY);
      return session.execute(new GroupCommand(session, args.string(0), args.strings(1)));
    });
    this.register('ungroup', 'ungroup <gid>', args => {
      args.expect(1);
      return session.execute(new UngroupCommand(session, args.string(0)));
    });
    this.register('addto', 'addto <gid> <id>', args => {
      args.expect(2);
      return session.execute(new AddToCommand(session, args.string(0), args.string(1)));
    });
    this.register('front', 'front <id>', args => {
      args.expect(1);
      return session.execute(new FrontCommand(session, args.string(0)));
    });
    this.register('back', 'back <id>', args => {
      args.expect(1);
      return session.execute(new BackCommand(session, args.string(0)));
    });
    this.register('tree', 'tree [id]', args => {
      args.expect(0, 1);
      return this.view.tree(session.document, args.length ? args.string(0) : undefined);
    });
    this.register('show', 'show <id>', args => {
      args.expect(1);
      return this.view.show(session.document, args.string(0));
    });
    this.register('help', 'help', args => {
      args.expect(0);
      return [...this.entries.values()].map(entry => entry.syntax).join('\n');
    });
    this.register('undo', 'undo', args => {
      args.expect(0);
      return session.undo();
    });
    this.register('redo', 'redo', args => {
      args.expect(0);
      return session.redo();
    });
  }

  async execute(line: string): Promise<string> {
    try {
      const tokens = this.tokenizer.tokenize(line);
      if (!tokens.length) return '';
      const entry = this.entries.get(tokens[0].value);
      if (!entry) throw new Error(`unknown command: ${tokens[0].value}`);
      return await entry.run(new CommandArguments(tokens.slice(1), entry.syntax));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `error: ${message.replace(/[\r\n]+/g, ' ')}`;
    }
  }

  private register(name: string, syntax: string, run: CommandEntry['run']): void {
    this.entries.set(name, { syntax, run });
  }
}
