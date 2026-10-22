import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandTrigger } from '../src/application/CommandTrigger.js';
import { CommandFactory } from '../src/cli/CommandFactory.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { Rect } from '../src/domain/Rect.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(accept => { resolve = accept; });
  return { promise, resolve };
}

async function fixture() {
  const store = new MemoryDocumentStore();
  const session = new EditorSession(store);
  const factory = new CommandFactory(session);
  const run = (line: string) => new CommandTrigger(factory.parse(line)!, session.executor).run();
  await run('init');
  await run('create rect r 1 2 3 4');
  await run('move r 5 0');
  await run('undo');
  return { store, session, factory, run };
}

test('pending save rejects other entries without losing edits or history, then releases them', async t => {
  const { store, session, factory, run } = await fixture();
  const gate = deferred();
  const write = store.write.bind(store);
  t.mock.method(store, 'write', async (...args: Parameters<typeof write>) => {
    await gate.promise;
    await write(...args);
  });
  const codec = new SvgCodec();
  const before = codec.encode(session.document);
  const counts = [session.history.undoCount, session.history.redoCount];
  const saving = run('save saved.svg');
  assert.ok(saving instanceof Promise);

  for (const line of [
    'move r 10 0', 'init', 'read other.svg', 'save other.svg',
    'canvas 900 900', 'undo', 'redo', 'tree', 'help',
  ]) {
    assert.throws(() => run(line), /command in progress/, line);
  }
  assert.throws(() => session.undo(), /command in progress/);
  assert.throws(() => session.redo(), /command in progress/);
  const cli = new CommandDispatcher(factory, session.executor);
  assert.match(await cli.execute('move r 10 0'), /^error: command in progress\./);
  assert.equal(codec.encode(session.document), before);
  assert.deepEqual([session.history.undoCount, session.history.redoCount], counts);

  gate.resolve();
  assert.match(await saving, /saved to saved.svg/);
  assert.equal(codec.encode((await store.read('saved.svg')).document), before);
  assert.equal(session.history.undoCount, 0);
  assert.equal(session.history.redoCount, 0);
  await run('move r 10 0');
  assert.equal(session.document.find('r').attributes().x, '11');
  await run('undo');
  assert.equal(codec.encode(session.document), before);
});

test('pending read cannot overwrite intervening edits or initialization', async t => {
  const { store, session, run } = await fixture();
  const loaded = new SvgDocument(300, 200);
  loaded.add(new Rect('r', 100, 2, 3, 4));
  store.seed('loaded.svg', loaded);
  const gate = deferred();
  const read = store.read.bind(store);
  t.mock.method(store, 'read', async (path: string) => {
    await gate.promise;
    return read(path);
  });
  const original = session.document;
  const reading = run('read loaded.svg');
  for (const line of ['move r 10 0', 'init', 'save old.svg', 'undo', 'redo']) {
    assert.throws(() => run(line), /command in progress/);
  }
  assert.equal(session.document, original);
  assert.equal(session.document.find('r').attributes().x, '1');
  gate.resolve();
  await reading;
  assert.equal(session.document.width, 300);
  await run('move r 10 0');
  assert.equal(session.document.find('r').attributes().x, '110');
  await run('undo');
  assert.equal(session.document.find('r').attributes().x, '100');
});

for (const operation of ['read', 'write'] as const) {
  test(`failed ${operation} releases the executor and preserves both history stacks`, async t => {
    const { store, session, run } = await fixture();
    const gate = deferred();
    t.mock.method(store, operation, async () => {
      await gate.promise;
      throw new Error('IO failed');
    });
    const codec = new SvgCodec();
    const before = codec.encode(session.document);
    const counts = [session.history.undoCount, session.history.redoCount];
    const pending = run(operation === 'read' ? 'read failed.svg' : 'save failed.svg');
    assert.ok(pending instanceof Promise);
    const failure = assert.rejects(pending, /IO failed/);
    assert.throws(() => run('move r 10 0'), /command in progress/);
    gate.resolve();
    await failure;
    assert.equal(codec.encode(session.document), before);
    assert.deepEqual([session.history.undoCount, session.history.redoCount], counts);
    // 历史指令也经过执行器；同步的内部委托不能把自己锁住。
    await run('redo');
    assert.equal(session.document.find('r').attributes().x, '6');
    await run('undo');
    assert.equal(codec.encode(session.document), before);
  });
}

test('a synchronous command failure does not leave the executor busy', async () => {
  const { session, run } = await fixture();
  assert.throws(() => run('scale r 0'), /scale factor must be positive/);
  await run('redo');
  assert.equal(session.document.find('r').attributes().x, '6');
});
