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
import { ViewReceiver } from '../application/ViewReceiver.js';
import type { Command } from '../application/Command.js';
import type { CommandSource } from './CommandSource.js';
import { InitCommand } from '../application/InitCommand.js';
import { ReadCommand } from '../application/ReadCommand.js';
import { SaveCommand } from '../application/SaveCommand.js';
import { CanvasCommand } from '../application/CanvasCommand.js';
import { UndoCommand } from '../application/UndoCommand.js';
import { RedoCommand } from '../application/RedoCommand.js';
import { TreeCommand } from '../application/TreeCommand.js';
import { ShowCommand } from '../application/ShowCommand.js';
import { HelpCommand } from '../application/HelpCommand.js';

interface CommandEntry {
  readonly syntax: string;
  readonly create: (arguments_: CommandArguments) => Command;
}

/** Client：唯一的命令名注册点，只解析参数并绑定接收者，不执行业务。 */
export class CommandFactory implements CommandSource {
  private readonly entries = new Map<string, CommandEntry>();
  private readonly tokenizer = new Tokenizer();

  constructor(session: EditorSession) {
    const view = new ViewReceiver(session);
    this.register('init', 'init [w] [h]', args => {
      args.expect(0, 2);
      return new InitCommand(session, args.length > 0 ? args.number(0) : 800, args.length > 1 ? args.number(1) : 600);
    });
    this.register('read', 'read <file.svg>', args => {
      args.expect(1);
      return new ReadCommand(session, args.string(0));
    });
    this.register('save', 'save [file.svg]', args => {
      args.expect(0, 1);
      return new SaveCommand(session, args.length ? args.string(0) : undefined);
    });
    this.register('canvas', 'canvas [w] [h]', args => {
      args.expect(0, 2);
      if (args.length === 1) args.invalidUsage();
      return args.length ? new CanvasCommand(session, args.number(0), args.number(1)) : new CanvasCommand(session);
    });
    this.register('create', 'create <type> <id> [params...] [in <containerId>]', args => {
      const { arguments: values, parentId } = args.creation();
      values.expect(2, Number.POSITIVE_INFINITY);
      return new CreateCommand(session.edits, values.string(0), values.string(1), values.strings(2), parentId);
    });
    this.register('delete', 'delete <id>', args => {
      args.expect(1);
      return new DeleteCommand(session.edits, args.string(0));
    });
    this.register('move', 'move <id> <dx> <dy>', args => {
      args.expect(3);
      return new MoveCommand(session.edits, args.string(0), args.number(1), args.number(2));
    });
    this.register('scale', 'scale <id> <factor>', args => {
      args.expect(2);
      return new ScaleCommand(session.edits, args.string(0), args.number(1));
    });
    this.register('set', 'set <id> <attr> <value>', args => {
      args.expect(3);
      return new SetCommand(session.edits, args.string(0), args.string(1), args.string(2));
    });
    this.register('group', 'group <newGid> <id1> [id2...]', args => {
      args.expect(2, Number.POSITIVE_INFINITY);
      return new GroupCommand(session.edits, args.string(0), args.strings(1));
    });
    this.register('ungroup', 'ungroup <gid>', args => {
      args.expect(1);
      return new UngroupCommand(session.edits, args.string(0));
    });
    this.register('addto', 'addto <gid> <id>', args => {
      args.expect(2);
      return new AddToCommand(session.edits, args.string(0), args.string(1));
    });
    this.register('front', 'front <id>', args => {
      args.expect(1);
      return new FrontCommand(session.edits, args.string(0));
    });
    this.register('back', 'back <id>', args => {
      args.expect(1);
      return new BackCommand(session.edits, args.string(0));
    });
    this.register('tree', 'tree [id]', args => {
      args.expect(0, 1);
      return new TreeCommand(view, args.length ? args.string(0) : undefined);
    });
    this.register('show', 'show <id>', args => {
      args.expect(1);
      return new ShowCommand(view, args.string(0));
    });
    this.register('help', 'help', args => {
      args.expect(0);
      return new HelpCommand(this);
    });
    this.register('undo', 'undo', args => {
      args.expect(0);
      return new UndoCommand(session);
    });
    this.register('redo', 'redo', args => {
      args.expect(0);
      return new RedoCommand(session);
    });
  }

  parse(line: string): Command | undefined {
    const tokens = this.tokenizer.tokenize(line);
    if (!tokens.length) return undefined;
    const entry = this.entries.get(tokens[0].value);
    if (!entry) throw new Error(`unknown command: ${tokens[0].value}`);
    return entry.create(new CommandArguments(tokens.slice(1), entry.syntax));
  }

  help(): string {
    return [...this.entries.values()].map(entry => entry.syntax).join('\n');
  }

  private register(name: string, syntax: string, create: CommandEntry['create']): void {
    this.entries.set(name, { syntax, create });
  }
}
