import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { EditorSession } from '../src/application/EditorSession.js';
import { SvgFileStore } from '../src/infrastructure/SvgFileStore.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { Tokenizer } from '../src/cli/Tokenizer.js';
import { Cli } from '../src/cli/Cli.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

test('tokenization preserves colors, Chinese, quoted in, empty text and escaped quotes', () => {
  const tokenizer = new Tokenizer();
  assert.deepEqual(tokenizer.tokenize('  # a comment'), []);
  assert.deepEqual(tokenizer.tokenize('create text t 0 0 "in" in node').map(t => [t.value, t.quoted]), [
    ['create', false], ['text', false], ['t', false], ['0', false], ['0', false], ['in', true], ['in', false], ['node', false],
  ]);
  assert.equal(tokenizer.tokenize('set r fill #4a90d9').at(-1)?.value, '#4a90d9');
  assert.equal(tokenizer.tokenize('set t text "你好 \\"world\\""').at(-1)?.value, '你好 "world"');
  assert.equal(tokenizer.tokenize('set t text ""').at(-1)?.value, '');
  assert.throws(() => tokenizer.tokenize('set t text "oops'), /unterminated/);
});

test('CLI errors use the prescribed messages and keep state and history intact', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandDispatcher(session);
  assert.equal(await cli.execute('tree'), "error: no document. use 'init' or 'read' first");
  await cli.execute('init');
  await cli.execute('create rect r 0 0 20 10');
  await cli.execute('create g g1');
  const before = await cli.execute('tree');
  const failures = [
    ['create rect r 0 0 1 1', 'id already exists: r'],
    ['move missing 1 2', 'no such shape: missing'],
    ['create circle c 0 0 2 in missing', 'no such container: missing'],
    ['create circle c 0 0 2 in r', 'not a container: r'],
    ['create box b 0 0 10 10 "Title"', 'unknown shape type: box (is the plugin loaded?)'],
    ['scale r 0', 'scale factor must be positive'],
    ['set r rotation 10', 'unknown attribute: rotation'],
    ['ungroup g1', 'cannot ungroup top-level container: g1'],
  ];
  for (const [line, error] of failures) {
    assert.equal(await cli.execute(line), `error: ${error}`);
    assert.equal(await cli.execute('tree'), before);
    assert.equal(session.history.undoCount, 2);
  }
});

test('quoted text and creation suffixes work for every built-in type', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandDispatcher(session);
  for (const line of [
    'init 400 300', 'create g scene', 'create g nested in scene',
    'create rect r 1.5 2 20 10 #ffffff in scene', 'create circle c 10 10 5 in scene',
    'create ellipse e 10 20 3 4 in scene', 'create line l 0 0 20 20 black in scene',
    'create text t 10 20 "Hello in #中文" in scene', 'create text empty 0 0 "" in nested',
    'create text keyword 0 0 "in"',
  ]) assert.doesNotMatch(await cli.execute(line), /^error:/, line);
  assert.equal(session.document.find('t').text, 'Hello in #中文');
  assert.equal(session.document.find('empty').text, '');
  assert.equal(session.document.find('keyword').parent, session.document.root);
  assert.equal(session.document.find('nested').parent?.id, 'scene');
  const tree = await cli.execute('tree scene');
  assert.match(tree, /^g#scene\n├── g#nested/m);
  assert.match(tree, /rect#r x=1.5 y=2 w=20 h=10 fill=#ffffff/);
  assert.match(await cli.execute('show t'), /parent=g#scene/);
  assert.match(await cli.execute('show t'), /text="Hello in #中文"/);
});

test('invalid syntax, quote and numeric errors neither edit nor consume redo', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandDispatcher(session);
  await cli.execute('init');
  await cli.execute('create circle c 0 0 2');
  await cli.execute('move c 4 5');
  await cli.execute('undo');
  for (const line of ['move c 1', 'move c NaN 0', 'move c 0x10 0', 'set c fill "oops', 'canvas 20', 'create circle bad 0 0 -2', 'nonsense']) {
    assert.match(await cli.execute(line), /^error:/);
    assert.equal(session.history.redoCount, 1);
    assert.equal(session.document.find('c').attributes().cx, '0');
  }
  await cli.execute('redo');
  assert.equal(session.document.find('c').attributes().cx, '4');
});

test('display and comments preserve history while successful IO establishes a barrier', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  const cli = new CommandDispatcher(session);
  await cli.execute('init');
  await cli.execute('create circle c 0 0 2');
  for (const line of ['tree', 'show c', 'help', 'canvas', '# ignored', '']) await cli.execute(line);
  assert.equal(session.history.undoCount, 1);
  const help = await cli.execute('help');
  for (const name of ['init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set', 'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'help', 'undo', 'redo']) {
    assert.match(help, new RegExp(`^${name}(?: |$)`, 'm'));
  }
  await cli.execute('save "my drawing.svg"');
  assert.equal(await cli.execute('undo'), 'error: undo not allowed after io command');
  assert.equal(await cli.execute('redo'), 'error: undo not allowed after io command');
  await cli.execute('move c 1 2');
  assert.doesNotMatch(await cli.execute('undo'), /^error:/);
});

test('assignment session saves, imports and keeps all seven imported shapes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-cli-'));
  try {
    const cli = new CommandDispatcher(new EditorSession(new SvgFileStore()));
    const lines = [
      'init 800 600', 'create rect bg 0 0 800 600 #ffffff', 'create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red', 'create rect box 200 80 60 60 #3366ff',
      'group markers c1 box', 'move c1 30 0', 'undo', 'redo',
      'set title text "My Diagram v2"', 'undo',
    ];
    for (const line of lines) assert.doesNotMatch(await cli.execute(line), /^error:/);
    assert.equal(await cli.execute('group bad c1 markers'), 'error: cannot group a container into its own descendant: markers');
    await cli.execute('delete box');
    await cli.execute('undo');
    const filename = join(directory, 'demo.svg');
    assert.equal(await cli.execute(`save "${filename}"`), `saved to ${filename} (5 elements)`);
    assert.match(await readFile(filename, 'utf8'), /<text id="title" x="20" y="40">My Diagram<\/text>/);
    const fixture = resolve('test/fixtures/other.svg');
    assert.match(await cli.execute(`read "${fixture}"`), /^warning: assigned id rect1 to unnamed <rect>\nread .+ \(7 elements\)$/);
    const tree = await cli.execute('tree');
    assert.match(tree, /svg \(400x300\)/);
    assert.match(tree, /ellipse#e1 cx=1 cy=2 rx=3 ry=4/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('piped CLI continues after an error, handles EOF and emits no interactive prompts', async () => {
  const dispatcher = new CommandDispatcher(new EditorSession(new MemoryDocumentStore()));
  let output = '';
  const destination = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Cli(dispatcher, Readable.from(['init\n', 'move missing 0 0\n', 'create circle c 1 2 3\n', 'tree\n']), destination).run();
  assert.match(output, /error: no such shape: missing/);
  assert.match(output, /circle#c cx=1 cy=2 r=3/);
  assert.doesNotMatch(output, /svg>/);
});

test('compiled entry point executes a complete script as a separate process', () => {
  const result = spawnSync(process.execPath, ['dist/src/main.js'], {
    cwd: resolve('.'), encoding: 'utf8',
    input: 'init 20 30\ncreate text t 1 2 "中文"\ntree\n',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /svg \(20x30\)/);
  assert.match(result.stdout, /text#t \(1,2\) "中文"/);
});
