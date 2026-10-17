import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { SvgFileStore } from '../src/infrastructure/SvgFileStore.js';

test('assignment other.svg imports seven elements with the required missing-id warning', async () => {
  const xml = await readFile('test/fixtures/other.svg', 'utf8');
  const { document, warnings } = new SvgCodec().decode(xml);
  assert.equal(document.width, 400);
  assert.equal(document.height, 300);
  assert.equal(document.count(), 7);
  assert.deepEqual(warnings, ['warning: assigned id rect1 to unnamed <rect>']);
  assert.deepEqual(document.root.children.map(shape => shape.id), ['rect1', 't1', 'c1', 'g1', 'e1']);
  assert.deepEqual(document.allShapes().find(shape => shape.id === 'g1')!.children.map(shape => shape.id), ['r2', 'c2']);
});

test('missing ids avoid every explicit id, including those later in the file', () => {
  const { document, warnings } = new SvgCodec().decode(`
    <svg><rect/><g><rect id="rect1"/><rect/></g><g id="g1"/></svg>`);
  assert.deepEqual(document.allShapes().map(shape => shape.id), ['rect2', 'g2', 'rect1', 'rect3', 'g1']);
  assert.deepEqual(warnings, [
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id g2 to unnamed <g>',
    'warning: assigned id rect3 to unnamed <rect>',
  ]);
});

test('duplicate, empty and whitespace-containing ids are rejected before importing', () => {
  const codec = new SvgCodec();
  assert.throws(() => codec.decode('<svg><g id="same"><rect id="same"/></g></svg>'), /id already exists: same/);
  assert.throws(() => codec.decode('<svg><rect id=""/></svg>'), /id must not be empty/);
  assert.throws(() => codec.decode('<svg><rect id="a b"/></svg>'), /id must not be empty/);
});

test('Chinese, significant text spaces and XML special characters survive serialization', () => {
  const factory = new ShapeFactory();
  const document = new SvgDocument(320, 240);
  const content = '  开始 & <处理> "引号" \'单引号\'  ';
  document.add(factory.fromSvg('text', 'title', { x: '12.5', y: '40', 'data-note': '甲 & "乙" <丙>' }, content));
  const codec = new SvgCodec();
  const encoded = codec.encode(document);
  assert.match(encoded, /&amp;/);
  assert.match(encoded, /&lt;/);
  assert.match(encoded, /&quot;/);
  const imported = codec.decode(encoded).document;
  assert.equal(imported.root.children[0]!.text, content);
  assert.equal(imported.root.children[0]!.attributes()['data-note'], '甲 & "乙" <丙>');
});

test('SVG defaults are retained by omitting fill and stroke attributes', () => {
  const codec = new SvgCodec();
  const { document } = codec.decode('<svg><rect id="r" x="0" y="0" width="10" height="10"/><line id="l"/></svg>');
  const saved = codec.encode(document);
  assert.doesNotMatch(saved, /\sfill=/);
  assert.doesNotMatch(saved, /\sstroke=/);
  assert.deepEqual(codec.decode(saved).document.allShapes().map(shape => shape.id), ['r', 'l']);
});

test('nested order, transform, root viewport and imported presentation attributes survive round-trip', () => {
  const codec = new SvgCodec();
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="400px" height="300" viewBox="-10 -20 200 150" fill="purple">
    <g id="outer" transform="translate(60,40)"><rect id="a"/><g id="inner" data-kind="box" transform="scale(0.8)">
      <text id="label" x="60" y="38" font-size="16" text-anchor="middle">开始</text>
      <circle id="b"/>
    </g><line id="last"/></g></svg>`;
  const imported = codec.decode(codec.encode(codec.decode(source).document)).document;
  assert.deepEqual(imported.allShapes().map(shape => shape.id), ['outer', 'a', 'inner', 'label', 'b', 'last']);
  assert.equal(imported.rootAttributes().viewBox, '-10 -20 200 150');
  assert.equal(imported.rootAttributes().fill, 'purple');
  assert.equal(imported.allShapes()[0]!.attributes().transform, 'translate(60,40)');
  assert.equal(imported.allShapes()[2]!.tag, 'g');
  assert.equal(imported.allShapes()[2]!.attributes()['data-kind'], 'box');
  assert.equal(imported.allShapes()[3]!.attributes()['text-anchor'], 'middle');
  assert.equal(imported.allShapes()[3]!.attributes()['font-size'], '16');
});

test('malformed XML, external entities and unexpected SVG structure are rejected', () => {
  const codec = new SvgCodec();
  for (const xml of [
    '<svg><g></svg>',
    '<svg><rect id="r" width=10/></svg>',
    '<svg><text id="t">a & b</text></svg>',
    '<svg><text id="t">a ]]> b</text></svg>',
    '<svg><rect id="a" id="b"/></svg>',
    '<svg/> trailing',
    '<svg/><svg/>',
    '<svg><text id="t">\u0000</text></svg>',
    '<svg><text id="t">&#0;</text></svg>',
    '<svg><text id="t">&#xD800;</text></svg>',
    '<svg><text id="t">&#x110000;</text></svg>',
    '<!DOCTYPE svg SYSTEM "file:///etc/passwd"><svg/>',
    '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]><svg><text>&secret;</text></svg>',
    '<svg xmlns="http://example.com/not-svg"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect xmlns=""/></svg>',
    '<html/>',
    '<svg><rect><circle/></rect></svg>',
    '<svg><text><rect/></text></svg>',
    '<svg><g>unexpected text</g></svg>',
    '<svg><?xml-stylesheet href="other.css"?></svg>',
    '<svg width="100%"/>',
    '<svg viewBox="0 0 0 20"/>',
  ]) assert.throws(() => codec.decode(xml), /invalid SVG/, xml);
  assert.throws(() => codec.decode('<svg><polygon/></svg>'), /unknown shape type: polygon/);
  assert.throws(() => codec.decode('<svg><box/></svg>'), /unknown shape type: box/);
});

test('CDATA and comments do not corrupt text content', () => {
  const codec = new SvgCodec();
  const document = codec.decode('<svg><!-- comment --><text id="t">  甲<![CDATA[<&>]]><!-- skip -->乙  </text></svg>').document;
  assert.equal(document.root.children[0]!.text, '  甲<&>乙  ');
  assert.equal(codec.decode(codec.encode(document)).document.root.children[0]!.text, '  甲<&>乙  ');
});

test('file store replaces an existing SVG and leaves no temporary files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-editor-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'drawing.svg');
  await writeFile(path, 'old file');
  const document = new SvgCodec().decode('<svg width="123" height="456"><circle id="c"/></svg>').document;
  const store = new SvgFileStore();
  await store.write(path, document);
  assert.equal((await store.read(path)).document.width, 123);
  assert.deepEqual(await readdir(directory), ['drawing.svg']);
});

test('file errors use required messages and preserve the existing target on failure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-editor-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new SvgFileStore();
  const missing = join(directory, 'missing.svg');
  await assert.rejects(store.read(missing), { message: `cannot read file: ${missing}` });
  const missingParent = join(directory, 'absent', 'new.svg');
  await assert.rejects(store.write(missingParent, new SvgDocument()), { message: `cannot write file: ${missingParent}` });

  const target = join(directory, 'existing.svg');
  await mkdir(target);
  await writeFile(join(target, 'keep.txt'), 'keep me');
  await assert.rejects(store.write(target, new SvgDocument()), { message: `cannot write file: ${target}` });
  assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'keep me');
  assert.deepEqual(await readdir(directory), ['existing.svg']);

  const malformed = join(directory, 'malformed.svg');
  await writeFile(malformed, '<svg><g></svg>');
  await assert.rejects(store.read(malformed), /invalid SVG: malformed XML/);
});

test('serialization failure cannot truncate the previous file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-editor-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'existing.svg');
  await writeFile(path, 'previous content');
  const codec = new SvgCodec();
  const stub = mock.method(codec, 'encode', () => { throw new Error('serialization failed'); });
  t.after(() => stub.mock.restore());
  await assert.rejects(new SvgFileStore(codec).write(path, new SvgDocument()), /serialization failed/);
  assert.equal(await readFile(path, 'utf8'), 'previous content');
  assert.deepEqual(await readdir(directory), ['existing.svg']);
});
