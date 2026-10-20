import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandFactory } from '../src/cli/CommandFactory.js';
import { CommandTrigger } from '../src/application/CommandTrigger.js';
import { EditCommand } from '../src/application/EditCommand.js';
import { MoveCommand } from '../src/application/MoveCommand.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

async function fixture(): Promise<EditorSession> {
  const session = new EditorSession(new MemoryDocumentStore());
  const factory = new CommandFactory(session);
  await session.executor.executeCommand(factory.parse('init')!);
  await session.executor.executeCommand(factory.parse('create rect r 10 20 30 40')!);
  return session;
}

test('creation is side-effect free and execution is independent of the Client', async t => {
  const session = await fixture();
  const factory = new CommandFactory(session);
  const move = t.mock.method(session.edits, 'move');
  const count = session.history.undoCount;
  const command = factory.parse('move r 5 6')!;
  const help = factory.parse('help')!;
  assert.equal(move.mock.callCount(), 0);
  assert.equal(session.history.undoCount, count);
  assert.equal(session.document.find('r').attributes().x, '10');
  // 创建阶段结束后，所有 Client 方法均不可用；已创建命令仍应独立工作。
  for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(factory))) {
    if (name !== 'constructor') {
      Object.defineProperty(factory, name, { value: () => { throw new Error('Client is unavailable'); } });
    }
  }
  assert.match(await new CommandTrigger(command, session.executor).run(), /moved by \(5,6\)/);
  assert.equal(move.mock.callCount(), 1);
  assert.match(await session.executor.executeCommand(help), /create <type>/);
});

test('Invoker calls ConcreteCommand then Receiver; successful execution alone changes stacks', async t => {
  const session = await fixture();
  const command = new MoveCommand(session.edits, 'r', 5, 6);
  const events: string[] = [];
  const count = session.history.undoCount;
  const execute = command.execute.bind(command);
  const move = session.edits.move.bind(session.edits);
  t.mock.method(command, 'execute', () => {
    events.push('command.execute');
    assert.equal(session.history.undoCount, count);
    return execute();
  });
  t.mock.method(session.edits, 'move', (...args: Parameters<typeof move>) => {
    events.push('receiver.move');
    return move(...args);
  });
  events.push('invoker.executeCommand');
  session.executor.executeCommand(command);
  events.push('execution.committed');
  assert.deepEqual(events, ['invoker.executeCommand', 'command.execute', 'receiver.move', 'execution.committed']);
  assert.equal(session.history.undoCount, count + 1);
  assert.equal(session.history.redoCount, 0);
});

test('undo and redo operate on the same stored command in LIFO order', async t => {
  const session = await fixture();
  const factory = new CommandFactory(session);
  const first = factory.parse('move r 1 0') as EditCommand;
  const second = factory.parse('set r fill blue') as EditCommand;
  const events: string[] = [];
  for (const [name, command] of [['first', first], ['second', second]] as const) {
    const execute = command.execute.bind(command);
    const undo = command.undo.bind(command);
    t.mock.method(command, 'execute', () => { events.push(`${name}.execute`); return execute(); });
    t.mock.method(command, 'undo', () => { events.push(`${name}.undo`); return undo(); });
  }
  session.executor.executeCommand(first);
  session.executor.executeCommand(second);
  session.undo();
  session.undo();
  session.redo();
  session.redo();
  assert.deepEqual(events, [
    'first.execute', 'second.execute', 'second.undo', 'first.undo', 'first.execute', 'second.execute',
  ]);
});

test('a failed undo does not pop or transfer the command; retry still works', async t => {
  const session = await fixture();
  const command = new MoveCommand(session.edits, 'r', 5, 6);
  session.executor.executeCommand(command);
  const count = session.history.undoCount;
  const failure = t.mock.method(command, 'undo', () => { throw new Error('undo failed'); });
  assert.throws(() => session.undo(), /undo failed/);
  assert.equal(session.history.undoCount, count);
  assert.equal(session.history.redoCount, 0);
  assert.equal(session.document.find('r').attributes().x, '15');
  failure.mock.restore();
  session.undo();
  assert.equal(session.document.find('r').attributes().x, '10');
  assert.equal(session.history.redoCount, 1);
});

test('history directives delegate to CommandExecutor and never enter the edit stack', async t => {
  const session = await fixture();
  const factory = new CommandFactory(session);
  const count = session.history.undoCount;
  const undo = t.mock.method(session.executor, 'undo');
  const redo = t.mock.method(session.executor, 'redo');
  await session.executor.executeCommand(factory.parse('undo')!);
  assert.equal(undo.mock.callCount(), 1);
  assert.equal(session.history.undoCount, count - 1);
  assert.equal(session.history.redoCount, 1);
  await session.executor.executeCommand(factory.parse('redo')!);
  assert.equal(redo.mock.callCount(), 1);
  assert.equal(session.history.undoCount, count);
  assert.equal(session.history.redoCount, 0);
});
