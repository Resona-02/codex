import assert from 'node:assert/strict';
import test from 'node:test';
import { AddToCommand } from '../src/application/AddToCommand.js';
import { BackCommand } from '../src/application/BackCommand.js';
import { CreateCommand } from '../src/application/CreateCommand.js';
import { DeleteCommand } from '../src/application/DeleteCommand.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { FrontCommand } from '../src/application/FrontCommand.js';
import { GroupCommand } from '../src/application/GroupCommand.js';
import { MoveCommand } from '../src/application/MoveCommand.js';
import { ScaleCommand } from '../src/application/ScaleCommand.js';
import { SetCommand } from '../src/application/SetCommand.js';
import { UngroupCommand } from '../src/application/UngroupCommand.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

function state(session: EditorSession): string {
  const document = session.document;
  return JSON.stringify({
    width: document.width,
    height: document.height,
    roots: document.root.children.map(shape => shape.id),
    shapes: document.allShapes().map(shape => ({
      id: shape.id,
      tag: shape.tag,
      parent: shape.parent?.id,
      attributes: shape.attributes(),
      text: shape.text,
      children: shape.children.map(child => child.id),
    })),
  });
}

async function fixture(): Promise<EditorSession> {
  const session = new EditorSession(new MemoryDocumentStore());
  await session.init();
  session.execute(new CreateCommand(session.edits, 'g', 'scene', []));
  session.execute(new CreateCommand(session.edits, 'g', 'nested', [], 'scene'));
  session.execute(new CreateCommand(session.edits, 'rect', 'r', ['10', '20', '30', '40', 'red'], 'nested'));
  session.execute(new CreateCommand(session.edits, 'circle', 'c', ['50', '60', '5'], 'nested'));
  session.execute(new CreateCommand(session.edits, 'text', 't', ['80', '90', '原始文字'], 'scene'));
  return session;
}

test('every concrete edit command restores the complete document and redoes it', async t => {
  const cases = [
    { name: 'create', command: (s: EditorSession) => new CreateCommand(s.edits, 'ellipse', 'e', ['1', '2', '3', '4'], 'scene') },
    { name: 'delete subtree', command: (s: EditorSession) => new DeleteCommand(s.edits, 'nested') },
    { name: 'move container', command: (s: EditorSession) => new MoveCommand(s.edits, 'nested', 5, -2) },
    { name: 'scale container', command: (s: EditorSession) => new ScaleCommand(s.edits, 'nested', 1.5) },
    { name: 'set geometry', command: (s: EditorSession) => new SetCommand(s.edits, 'r', 'width', '100') },
    { name: 'set Chinese text', command: (s: EditorSession) => new SetCommand(s.edits, 't', 'text', '新文字 & "value"') },
    { name: 'group', command: (s: EditorSession) => new GroupCommand(s.edits, 'selected', ['r', 'c']) },
    { name: 'ungroup', command: (s: EditorSession) => new UngroupCommand(s.edits, 'nested') },
    { name: 'addto', command: (s: EditorSession) => new AddToCommand(s.edits, 'nested', 't') },
    { name: 'front', command: (s: EditorSession) => new FrontCommand(s.edits, 'r') },
    { name: 'back', command: (s: EditorSession) => new BackCommand(s.edits, 'c') },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const session = await fixture();
      const before = state(session);
      const count = session.history.undoCount;
      const result = session.execute(item.command(session));
      const after = state(session);
      assert.notEqual(after, before);
      assert.equal(session.history.undoCount, count + 1);
      session.undo();
      assert.equal(state(session), before);
      assert.equal(session.history.redoCount, 1);
      assert.equal(session.redo(), result);
      assert.equal(state(session), after);
    });
  }
});

test('local undo records stay independent across several undo and redo steps', async () => {
  const session = await fixture();
  const original = state(session);
  session.execute(new MoveCommand(session.edits, 'r', 10, 20));
  const moved = state(session);
  session.execute(new SetCommand(session.edits, 'r', 'fill', 'blue'));
  const recolored = state(session);
  session.undo();
  assert.equal(state(session), moved);
  session.undo();
  assert.equal(state(session), original);
  session.redo();
  assert.equal(state(session), moved);
  session.redo();
  assert.equal(state(session), recolored);
});

test('failed edits preserve document, undo history and pending redo', async () => {
  const session = await fixture();
  session.execute(new MoveCommand(session.edits, 'r', 5, 6));
  session.undo();
  const before = state(session);
  const undoCount = session.history.undoCount;
  const failures = [
    new CreateCommand(session.edits, 'rect', 'r', ['0', '0', '10', '10']),
    new CreateCommand(session.edits, 'circle', 'new', ['0', '0', '10'], 'missing'),
    new SetCommand(session.edits, 'r', 'unknown', 'x'),
    new ScaleCommand(session.edits, 'nested', 0),
    new GroupCommand(session.edits, 'bad', ['nested', 'r']),
    new AddToCommand(session.edits, 'nested', 'scene'),
    new UngroupCommand(session.edits, 'scene'),
    new DeleteCommand(session.edits, 'missing'),
  ];
  for (const command of failures) {
    assert.throws(() => session.execute(command));
    assert.equal(state(session), before);
    assert.equal(session.history.undoCount, undoCount);
    assert.equal(session.history.redoCount, 1);
  }
  session.redo();
  assert.equal(session.document.find('r').attributes().x, '15');
});

test('a successful edit after undo clears redo and operates on the restored document', async () => {
  const session = await fixture();
  session.execute(new MoveCommand(session.edits, 'r', 5, 6));
  session.undo();
  session.execute(new SetCommand(session.edits, 'r', 'fill', 'blue'));
  assert.equal(session.document.find('r').attributes().x, '10');
  assert.equal(session.document.find('r').attributes().fill, 'blue');
  assert.equal(session.history.redoCount, 0);
  assert.throws(() => session.redo(), /nothing to redo/);
});

test('a container edit rolls back children already changed before a later child fails', async () => {
  const session = await fixture();
  session.execute(new SetCommand(session.edits, 'c', 'cx', '1e308'));
  const before = state(session);
  const count = session.history.undoCount;
  // r 的缩放先成功，随后 c 的数值溢出；命令必须整体回滚。
  assert.throws(() => session.execute(new ScaleCommand(session.edits, 'nested', 2)), /invalid number/);
  assert.equal(state(session), before);
  assert.equal(session.history.undoCount, count);
  session.undo();
  assert.equal(session.document.find('c').attributes().cx, '50');
});

test('canvas query preserves history; successful resize establishes the IO barrier', async () => {
  const session = await fixture();
  const undoCount = session.history.undoCount;
  assert.equal(session.canvas(), 'canvas 800x600');
  assert.equal(session.history.undoCount, undoCount);
  session.undo();
  assert.equal(session.history.redoCount, 1);
  session.canvas(400, 300);
  assert.equal(session.history.undoCount, 0);
  assert.equal(session.history.redoCount, 0);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
  assert.throws(() => session.execute(new DeleteCommand(session.edits, 'missing')));
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.execute(new MoveCommand(session.edits, 'r', 1, 0));
  session.undo();
  assert.equal(session.document.find('r').attributes().x, '10');
});

test('invalid canvas and init preserve the document and history', async () => {
  const session = await fixture();
  const before = state(session);
  const count = session.history.undoCount;
  assert.throws(() => session.canvas(100, -2));
  assert.throws(() => session.canvas(100));
  await assert.rejects(session.init(-1, 100));
  assert.equal(state(session), before);
  assert.equal(session.history.undoCount, count);
  session.undo();
});

test('init and read establish barriers; read forwards warnings and remembers the path', async () => {
  const store = new MemoryDocumentStore();
  const session = new EditorSession(store);
  await session.init();
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  const imported = new SvgDocument(200, 100);
  store.seed('input.svg', imported, ['warning: assigned id rect1 to unnamed <rect>']);
  assert.equal(await session.read('input.svg'), 'warning: assigned id rect1 to unnamed <rect>\nread input.svg (0 elements)');
  assert.throws(() => session.redo(), /undo not allowed after io command/);
  session.execute(new CreateCommand(session.edits, 'g', 'new', []));
  assert.equal(await session.save(), 'saved to input.svg (1 elements)');
  assert.equal((await store.read('input.svg')).document.count(), 1);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test('failed file operations preserve the document, path and both history stacks', async () => {
  const store = new MemoryDocumentStore();
  const session = new EditorSession(store);
  await session.init();
  session.execute(new CreateCommand(session.edits, 'g', 'g1', []));
  await session.save('original.svg');
  session.execute(new CreateCommand(session.edits, 'g', 'g2', []));
  session.execute(new MoveCommand(session.edits, 'g1', 10, 20));
  session.undo();
  const before = state(session);
  store.rejectWrites(true);
  await assert.rejects(session.read('missing.svg'), /cannot read file/);
  await assert.rejects(session.save('failed.svg'), /cannot write file/);
  assert.equal(state(session), before);
  assert.equal(session.history.undoCount, 1);
  assert.equal(session.history.redoCount, 1);
  store.rejectWrites(false);
  assert.equal(await session.save(), 'saved to original.svg (2 elements)');
});

test('init clears the remembered save path, and failed pathless save leaves edits undoable', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  await session.init();
  await session.save('old.svg');
  await session.init();
  session.execute(new CreateCommand(session.edits, 'g', 'g', []));
  await assert.rejects(session.save(), /no file path/);
  session.undo();
  assert.equal(session.document.count(), 0);
});

test('every document-dependent operation requires init or read first', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const message = /no document\. use 'init' or 'read' first/;
  assert.throws(() => session.document, message);
  assert.throws(() => session.canvas(), message);
  assert.throws(() => session.undo(), message);
  assert.throws(() => session.redo(), message);
  assert.throws(() => session.execute(new CreateCommand(session.edits, 'g', 'g', [])), message);
  await assert.rejects(session.save('test.svg'), message);
});
