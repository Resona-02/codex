import assert from 'node:assert/strict';
import test from 'node:test';
import { Shape } from '../src/domain/Shape.js';
import { Rect } from '../src/domain/Rect.js';
import { Circle } from '../src/domain/Circle.js';
import { Ellipse } from '../src/domain/Ellipse.js';
import { Line } from '../src/domain/Line.js';
import { Text } from '../src/domain/Text.js';
import { Group } from '../src/domain/Group.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { MoveCommand } from '../src/application/MoveCommand.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { MemoryDocumentStore } from './helpers/MemoryDocumentStore.js';

test('position undo restores only coordinates for each leaf type', async t => {
  const cases: { shape: Shape; coordinates: string[]; attribute: string; value: string }[] = [
    { shape: new Rect('r', 0.1, 0.2, 3, 4), coordinates: ['x', 'y'], attribute: 'width', value: '99' },
    { shape: new Circle('c', 0.1, 0.2, 3), coordinates: ['cx', 'cy'], attribute: 'r', value: '99' },
    { shape: new Ellipse('e', 0.1, 0.2, 3, 4), coordinates: ['cx', 'cy'], attribute: 'rx', value: '99' },
    { shape: new Line('l', 0.1, 0.2, 0.3, 0.4), coordinates: ['x1', 'y1', 'x2', 'y2'], attribute: 'stroke', value: 'red' },
    { shape: new Text('t', 0.1, 0.2, 'old'), coordinates: ['x', 'y'], attribute: 'text', value: 'new' },
  ];
  for (const { shape, coordinates, attribute, value } of cases) {
    await t.test(shape.tag, () => {
      const before = shape.attributes();
      const restore = shape.rememberPosition();
      shape.move(0.2, 0.3);
      // 单独修改其他字段，检验位置恢复不会覆盖尺寸、样式或文字。
      shape.setAttribute(attribute, value);
      restore();
      for (const name of coordinates) assert.equal(shape.attributes()[name], before[name]);
      assert.equal(attribute === 'text' ? shape.text : shape.attributes()[attribute], value);
    });
  }
});

test('nested Composite position undo restores descendants and preserves non-position fields', () => {
  const outer = new Group('outer');
  const inner = new Group('inner');
  const rect = new Rect('r', 0.1, 0.2, 3, 4);
  const circle = new Circle('c', 0.3, 0.4, 5);
  outer.insert(inner);
  inner.insert(rect);
  inner.insert(circle);
  inner.insert(new Group('empty'));
  const restore = outer.rememberPosition();
  outer.move(0.2, 0.3);
  rect.setAttribute('width', '88');
  circle.setAttribute('r', '99');
  inner.setAttribute('fill', 'blue');
  restore();
  assert.equal(rect.attributes().x, '0.1');
  assert.equal(circle.attributes().cy, '0.4');
  assert.equal(rect.attributes().width, '88');
  assert.equal(circle.attributes().r, '99');
  assert.equal(inner.attributes().fill, 'blue');
  assert.equal(rect.parent, inner);
});

test('move, undo and redo do not capture full geometry, including imported inline-styled shapes', async t => {
  const session = new EditorSession(new MemoryDocumentStore());
  await session.init();
  const group = new Group('g');
  const rect = new Rect('r', 0.1, 0.2, 3, 4);
  rect.importAttributes({ style: 'fill:red', transform: 'translate(5,6)' });
  group.insert(rect);
  session.document.add(group);
  t.mock.method(Shape.prototype, 'rememberGeometry', () => { throw new Error('full geometry capture forbidden'); });
  const before = new SvgCodec().encode(session.document);
  session.executor.executeCommand(new MoveCommand(session.edits, 'g', 0.2, 0.3));
  const after = new SvgCodec().encode(session.document);
  session.undo();
  assert.equal(new SvgCodec().encode(session.document), before);
  session.redo();
  assert.equal(new SvgCodec().encode(session.document), after);
});

test('coordinate-only records roll back a partially failed group move and preserve redo', async () => {
  const session = new EditorSession(new MemoryDocumentStore());
  await session.init();
  const group = new Group('g');
  group.insert(new Rect('first', 0.1, 0.2, 3, 4));
  group.insert(new Circle('last', 1e308, 0.4, 5));
  session.document.add(group);
  session.execute(new MoveCommand(session.edits, 'first', 1, 2));
  session.undo();
  const before = new SvgCodec().encode(session.document);
  const count = session.history.undoCount;
  assert.throws(() => session.execute(new MoveCommand(session.edits, 'g', 1e308, 0)), /invalid number/);
  assert.equal(new SvgCodec().encode(session.document), before);
  assert.equal(session.history.undoCount, count);
  assert.equal(session.history.redoCount, 1);
  session.redo();
  assert.equal(session.document.find('first').attributes().x, '1.1');
});
