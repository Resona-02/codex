import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandTrigger } from '../src/application/CommandTrigger.js';
import { SaveCommand } from '../src/application/SaveCommand.js';
import { CreateCommand } from '../src/application/CreateCommand.js';
import { MoveCommand } from '../src/application/MoveCommand.js';
import { ScaleCommand } from '../src/application/ScaleCommand.js';
import { SetCommand } from '../src/application/SetCommand.js';
import { GroupCommand } from '../src/application/GroupCommand.js';
import { UngroupCommand } from '../src/application/UngroupCommand.js';
import { DeleteCommand } from '../src/application/DeleteCommand.js';
import { AddToCommand } from '../src/application/AddToCommand.js';
import { FrontCommand } from '../src/application/FrontCommand.js';
import { BackCommand } from '../src/application/BackCommand.js';
import { CommandFactory } from '../src/cli/CommandFactory.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { Shape } from '../src/domain/Shape.js';
import { Rect } from '../src/domain/Rect.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

async function fixture(): Promise<EditorSession> {
  const session = new EditorSession(new MemoryDocumentStore());
  await session.init();
  session.execute(new CreateCommand(session.edits, 'g', 'scene', []));
  for (let index = 0; index < 6; index++) {
    session.execute(new CreateCommand(session.edits, 'rect', `r${index}`, ['0.1', '0.2', '10', '20'], 'scene'));
  }
  return session;
}

test('three simulated UI entries share one abstract save command and executor', async t => {
  const session = await fixture();
  const save = new SaveCommand(session, 'shared.svg');
  const menu = new CommandTrigger(save, session.executor);
  const contextMenu = new CommandTrigger(save, session.executor);
  const toolbar = new CommandTrigger(save, session.executor);
  const execute = t.mock.method(session.executor, 'executeCommand');
  const receiver = t.mock.method(session, 'save');
  for (const entry of [menu, contextMenu, toolbar]) assert.match(await entry.run(), /saved to shared.svg/);
  assert.equal(execute.mock.callCount(), 3);
  assert.ok(execute.mock.calls.every(call => call.arguments[0] === save));
  assert.equal(receiver.mock.callCount(), 3);
  assert.equal(session.history.undoCount, 0);
});

test('CLI routes editing, IO, display and history commands through the same executor', async t => {
  const session = new EditorSession(new MemoryDocumentStore());
  const dispatcher = new CommandDispatcher(new CommandFactory(session), session.executor);
  const execute = t.mock.method(session.executor, 'executeCommand');
  const cases = [
    ['help', 'HelpCommand'], ['init', 'InitCommand'],
    ['create g scene', 'CreateCommand'], ['create rect r 0 0 10 20 in scene', 'CreateCommand'],
    ['create circle c 0 0 3 in scene', 'CreateCommand'], ['move r 1 2', 'MoveCommand'],
    ['scale r 2', 'ScaleCommand'], ['set r fill red', 'SetCommand'],
    ['group nested r c', 'GroupCommand'], ['ungroup nested', 'UngroupCommand'],
    ['addto scene r', 'AddToCommand'], ['front r', 'FrontCommand'], ['back r', 'BackCommand'],
    ['tree', 'TreeCommand'], ['show r', 'ShowCommand'], ['undo', 'UndoCommand'], ['redo', 'RedoCommand'],
    ['delete c', 'DeleteCommand'], ['canvas 300 200', 'CanvasCommand'],
    ['save test.svg', 'SaveCommand'], ['read test.svg', 'ReadCommand'],
  ];
  for (const [line] of cases) assert.doesNotMatch(await dispatcher.execute(line!), /^error:/, line);
  assert.deepEqual(execute.mock.calls.map(call => call.arguments[0].constructor.name), cases.map(item => item[1]));
});

test('all edits, undo and redo work with document and shape cloning disabled', async t => {
  const session = await fixture();
  const document = session.document;
  const untouched = document.find('r5');
  const codec = new SvgCodec();
  t.mock.method(SvgDocument.prototype, 'clone', () => { throw new Error('document snapshot forbidden'); });
  for (const shape of document.allShapes()) {
    t.mock.method(shape, 'clone', () => { throw new Error('shape copy forbidden'); });
  }
  const initial = codec.encode(document);
  const commands = [
    new MoveCommand(session.edits, 'r0', 0.2, 0.3),
    new ScaleCommand(session.edits, 'r0', 1.3),
    new SetCommand(session.edits, 'r0', 'fill', 'red'),
    new GroupCommand(session.edits, 'nested', ['r4', 'r0', 'r2']),
    new UngroupCommand(session.edits, 'nested'),
    new AddToCommand(session.edits, 'scene', 'r1'),
    new FrontCommand(session.edits, 'r2'),
    new BackCommand(session.edits, 'r4'),
    new DeleteCommand(session.edits, 'r3'),
    new CreateCommand(session.edits, 'circle', 'new', ['1', '2', '3'], 'scene'),
  ];
  const states = [initial];
  for (const command of commands) {
    session.executor.executeCommand(command);
    states.push(codec.encode(document));
  }
  for (let index = commands.length - 1; index >= 0; index--) {
    session.undo();
    assert.equal(codec.encode(document), states[index]);
    assert.equal(session.document, document);
    assert.equal(document.find('r5'), untouched);
  }
  for (let index = 0; index < commands.length; index++) {
    session.redo();
    assert.equal(codec.encode(document), states[index + 1]);
  }
});

test('redo invokes the receiver again; repeated undo restores exact values without inverse arithmetic', async t => {
  const session = await fixture();
  const move = t.mock.method(session.edits, 'move');
  session.execute(new MoveCommand(session.edits, 'r0', 0.2, 0.3));
  for (let step = 0; step < 20; step++) {
    session.undo();
    assert.equal(session.document.find('r0').attributes().x, '0.1');
    session.redo();
    assert.equal(session.document.find('r0').attributes().x, '0.30000000000000004');
  }
  assert.equal(move.mock.callCount(), 21);
});

test('one-shape edits record only that shape even in a large document', async t => {
  const session = await fixture();
  for (let i = 0; i < 1000; i++) session.document.add(new Rect(`unrelated${i}`, 0, 0, 1, 1));
  const capture = t.mock.method(Shape.prototype, 'rememberGeometry');
  const target = session.document.find('r0');
  for (let i = 0; i < 100; i++) session.execute(new MoveCommand(session.edits, 'r0', 1, 1));
  assert.equal(capture.mock.callCount(), 100);
  assert.ok(capture.mock.calls.every(call => call.this === target));
  for (let i = 0; i < 100; i++) session.undo();
  assert.equal(target.attributes().x, '0.1');
  assert.equal(session.document.find('unrelated999').attributes().x, '0');
});

test('cross-parent grouping restores original parents, nonadjacent sibling order and object identity', async () => {
  const session = await fixture();
  session.execute(new GroupCommand(session.edits, 'left', ['r0', 'r1', 'r2']));
  session.execute(new GroupCommand(session.edits, 'right', ['r3', 'r4']));
  const codec = new SvgCodec();
  const before = codec.encode(session.document);
  const r0 = session.document.find('r0');
  session.execute(new GroupCommand(session.edits, 'across', ['r4', 'r2', 'r0']));
  const after = codec.encode(session.document);
  session.undo();
  assert.equal(codec.encode(session.document), before);
  assert.equal(session.document.find('r0'), r0);
  session.redo();
  assert.equal(codec.encode(session.document), after);
});

test('ungroup undo restores inherited and absent styles and the original group object', async () => {
  const session = await fixture();
  session.execute(new GroupCommand(session.edits, 'nested', ['r0', 'r1']));
  session.execute(new SetCommand(session.edits, 'nested', 'fill', 'red'));
  session.execute(new SetCommand(session.edits, 'r0', 'fill', 'inherit'));
  const group = session.document.find('nested');
  session.execute(new UngroupCommand(session.edits, 'nested'));
  assert.equal(session.document.find('r1').attributes().fill, 'red');
  session.undo();
  assert.equal(session.document.find('nested'), group);
  assert.equal(session.document.find('r0').attributes().fill, 'inherit');
  assert.equal(session.document.find('r1').attributes().fill, undefined);
  session.redo();
  assert.equal(session.document.find('r0').attributes().fill, 'red');
});

test('delete undo reinserts the original subtree without copying it', async () => {
  const session = await fixture();
  const scene = session.document.find('scene');
  const child = session.document.find('r0');
  session.execute(new DeleteCommand(session.edits, 'scene'));
  assert.equal(scene.parent, null);
  session.undo();
  assert.equal(session.document.find('scene'), scene);
  assert.equal(session.document.find('r0'), child);
  session.redo();
  assert.equal(scene.parent, null);
});

test('a failed redo rolls back partial changes and stays available on the redo stack', async () => {
  const session = await fixture();
  session.execute(new ScaleCommand(session.edits, 'scene', 2));
  session.undo();
  // 模拟接收者状态变化造成重放失败：前面的节点已修改，后面的节点溢出。
  session.document.find('r1').setAttribute('x', '1e308');
  const codec = new SvgCodec();
  const before = codec.encode(session.document);
  const count = session.history.undoCount;
  assert.throws(() => session.redo(), /invalid number/);
  assert.equal(codec.encode(session.document), before);
  assert.equal(session.history.undoCount, count);
  assert.equal(session.history.redoCount, 1);
  session.document.find('r1').setAttribute('x', '0.1');
  session.redo();
  assert.equal(session.history.redoCount, 0);
});
