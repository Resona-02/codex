import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandTrigger } from '../src/application/CommandTrigger.js';
import { CreateCommand } from '../src/application/CreateCommand.js';
import { DeleteCommand } from '../src/application/DeleteCommand.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { MoveCommand } from '../src/application/MoveCommand.js';
import { SaveCommand } from '../src/application/SaveCommand.js';
import { SetCommand } from '../src/application/SetCommand.js';
import { Circle } from '../src/domain/Circle.js';
import { Group } from '../src/domain/Group.js';
import { Rect } from '../src/domain/Rect.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

async function fixture() {
  const store = new MemoryDocumentStore();
  const session = new EditorSession(store);
  await session.init();
  const rect = new Rect('r', 10, 20, 30, 40);
  session.document.add(rect);
  return { session, store, rect };
}

test('one bound editing action can run repeatedly with independent history and no document copies', async t => {
  const { session, rect } = await fixture();
  const trigger = new CommandTrigger(new MoveCommand(session.edits, 'r', 2, 3), session.executor);
  const move = t.mock.method(session.edits, 'move');
  const undo = t.mock.method(session.edits, 'undo');
  t.mock.method(session.document, 'clone', () => { throw new Error('document clone forbidden'); });
  t.mock.method(rect, 'clone', () => { throw new Error('shape clone forbidden'); });
  t.mock.method(rect, 'rememberGeometry', () => { throw new Error('full geometry capture forbidden'); });

  for (let index = 1; index <= 3; index++) {
    await trigger.run();
    assert.equal(rect.attributes().x, String(10 + 2 * index));
    assert.equal(rect.attributes().y, String(20 + 3 * index));
    assert.equal(session.history.undoCount, index);
  }
  const states = move.mock.calls.map(call => call.arguments[0]);
  assert.equal(new Set(states).size, 3);

  for (let index = 2; index >= 0; index--) {
    session.undo();
    assert.equal(rect.attributes().x, String(10 + 2 * index));
    assert.equal(rect.attributes().y, String(20 + 3 * index));
    assert.equal(session.history.undoCount, index);
  }
  for (let index = 0; index < 3; index++) {
    assert.equal(undo.mock.calls[index]!.arguments[0], states[2 - index]);
    session.redo();
    assert.equal(rect.attributes().x, String(12 + 2 * index));
    // Redo reuses each historical execution's state instead of creating a new edit.
    assert.equal(move.mock.calls[3 + index]!.arguments[0], states[index]);
  }
  assert.equal(session.history.redoCount, 0);
});

test('three entries may share one editing action and each click remains one undo unit', async () => {
  const { session, rect } = await fixture();
  const action = new MoveCommand(session.edits, 'r', 5, 0);
  const entries = Array.from({ length: 3 }, () => new CommandTrigger(action, session.executor));
  for (let round = 0; round < 2; round++) {
    for (const entry of entries) await entry.run();
  }
  assert.equal(rect.attributes().x, '40');
  assert.equal(session.history.undoCount, 6);
  for (let index = 5; index >= 0; index--) {
    session.undo();
    assert.equal(rect.attributes().x, String(10 + 5 * index));
  }
  for (let index = 1; index <= 6; index++) {
    session.redo();
    assert.equal(rect.attributes().x, String(10 + 5 * index));
  }
});

test('clicking a bound action after undo creates a new branch without reusing old undo state', async t => {
  const { session, rect } = await fixture();
  const trigger = new CommandTrigger(new MoveCommand(session.edits, 'r', 5, 0), session.executor);
  const move = t.mock.method(session.edits, 'move');
  await trigger.run();
  await trigger.run();
  session.undo();
  assert.equal(rect.attributes().x, '15');
  assert.equal(session.history.redoCount, 1);
  await trigger.run();
  assert.equal(rect.attributes().x, '20');
  assert.equal(session.history.redoCount, 0);
  assert.equal(new Set(move.mock.calls.map(call => call.arguments[0])).size, 3);
  session.undo();
  assert.equal(rect.attributes().x, '15');
  session.undo();
  assert.equal(rect.attributes().x, '10');
  session.redo();
  session.redo();
  assert.equal(rect.attributes().x, '20');
});

test('a bound action whose first execution fails can be retried after its target is created', async () => {
  const { session } = await fixture();
  const trigger = new CommandTrigger(new MoveCommand(session.edits, 'later', 5, 0), session.executor);
  assert.throws(() => trigger.run(), /no such shape: later/);
  assert.equal(session.history.undoCount, 0);
  session.execute(new CreateCommand(session.edits, 'rect', 'later', ['1', '2', '3', '4']));
  await trigger.run();
  assert.equal(session.document.find('later').attributes().x, '6');
  session.undo();
  assert.equal(session.document.find('later').attributes().x, '1');
  session.redo();
  assert.equal(session.document.find('later').attributes().x, '6');
});

test('a failed repeated click preserves history and the same entry remains retryable', async () => {
  const { session, rect } = await fixture();
  const trigger = new CommandTrigger(new MoveCommand(session.edits, 'r', 5, 0), session.executor);
  await trigger.run();
  session.execute(new DeleteCommand(session.edits, 'r'));
  assert.throws(() => trigger.run(), /no such shape: r/);
  assert.equal(session.history.undoCount, 2);
  assert.equal(session.history.redoCount, 0);
  session.undo();
  assert.equal(rect.attributes().x, '15');
  await trigger.run();
  assert.equal(rect.attributes().x, '20');
  assert.equal(session.history.redoCount, 0);
  session.undo();
  assert.equal(rect.attributes().x, '15');
  session.undo();
  assert.equal(rect.attributes().x, '10');
});

test('a partially failed group action rolls back and can be retried through the same entry', async () => {
  const { session } = await fixture();
  const group = new Group('g');
  const first = new Rect('first', 1, 2, 3, 4);
  const last = new Circle('last', 1e308, 2, 3);
  group.insert(first);
  group.insert(last);
  session.document.add(group);
  const trigger = new CommandTrigger(new MoveCommand(session.edits, 'g', 1e308, 0), session.executor);

  assert.throws(() => trigger.run(), /invalid number/);
  assert.equal(first.attributes().x, '1');
  assert.equal(last.attributes().cx, '1e+308');
  assert.equal(session.history.undoCount, 0);
  session.execute(new SetCommand(session.edits, 'last', 'cx', '0'));
  await trigger.run();
  assert.equal(first.attributes().x, '1e+308');
  assert.equal(last.attributes().cx, '1e+308');
  session.undo();
  assert.equal(first.attributes().x, '1');
  assert.equal(last.attributes().cx, '0');
  session.redo();
  assert.equal(first.attributes().x, '1e+308');
  assert.equal(last.attributes().cx, '1e+308');
});

test('a completed save barrier allows an already-used action to start independent history', async () => {
  const { session, store, rect } = await fixture();
  const trigger = new CommandTrigger(new MoveCommand(session.edits, 'r', 2, 0), session.executor);
  await trigger.run();
  await session.executor.executeCommand(new SaveCommand(session, 'saved.svg'));
  assert.equal(session.history.undoCount, 0);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  await trigger.run();
  assert.equal(rect.attributes().x, '14');
  assert.equal(session.history.undoCount, 1);
  session.undo();
  assert.equal(rect.attributes().x, '12');
  session.redo();
  assert.equal(rect.attributes().x, '14');
  assert.equal((await store.read('saved.svg')).document.find('r').attributes().x, '12');
});
