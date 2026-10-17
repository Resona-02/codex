import assert from "node:assert/strict";
import test from "node:test";
import { Circle } from "../src/domain/Circle.js";
import { Ellipse } from "../src/domain/Ellipse.js";
import { Group } from "../src/domain/Group.js";
import { Line } from "../src/domain/Line.js";
import { Rect } from "../src/domain/Rect.js";
import { ShapeFactory } from "../src/domain/ShapeFactory.js";
import { SvgDocument } from "../src/domain/SvgDocument.js";
import { Text } from "../src/domain/Text.js";

test("all concrete shapes own their geometry and preserve SVG default styles", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const circle = new Circle("c", 1, 2, 3, "red");
  const ellipse = new Ellipse("e", 1, 2, 3, 4);
  const line = new Line("l", 1, 2, 3, 4, "black");
  const text = new Text("t", 1, 2, "开始");
  for (const shape of [rect, circle, ellipse, line, text]) {
    shape.move(10, 20);
    shape.scale(2);
  }
  assert.deepEqual(rect.attributes(), { id: "r", x: "22", y: "44", width: "6", height: "8" });
  assert.deepEqual(circle.attributes(), { id: "c", cx: "22", cy: "44", r: "6", fill: "red" });
  assert.deepEqual(ellipse.attributes(), { id: "e", cx: "22", cy: "44", rx: "6", ry: "8" });
  assert.deepEqual(line.attributes(), { id: "l", x1: "22", y1: "44", x2: "26", y2: "48", stroke: "black" });
  assert.deepEqual(text.attributes(), { id: "t", x: "22", y: "44" });
  assert.equal(text.text, "开始");
  assert.match(rect.summary(), /rect#r x=22 y=44 w=6 h=8/);
});

test("attribute editing has a type-specific whitelist and protected values", () => {
  const rect = new Rect("r", 0, 0, 2, 3);
  rect.setAttribute("width", "2.5");
  rect.setAttribute("fill", "#fff");
  rect.setAttribute("stroke", "black");
  rect.setAttribute("stroke-width", "1.5");
  assert.equal(rect.attributes().width, "2.5");
  assert.throws(() => rect.setAttribute("cx", "4"), /unknown attribute: cx/);
  assert.throws(() => rect.setAttribute("id", "different"), /unknown attribute: id/);
  assert.throws(() => rect.setAttribute("height", "-1"), /height must be non-negative/);
  assert.throws(() => rect.setAttribute("stroke-width", "-1"), /stroke-width must be non-negative/);
  assert.equal(rect.id, "r");
  assert.equal(rect.attributes().height, "3");
  const attributes = rect.attributes() as Record<string, string>;
  attributes.width = "999";
  assert.equal(rect.attributes().width, "2.5");
  const text = new Text("t", 0, 0, "old");
  text.setAttribute("text", "new text");
  assert.equal(text.text, "new text");
});

test("numeric validation prevents invalid dimensions and partial leaf operations", () => {
  assert.throws(() => new Circle("c", 0, 0, -1), /r must be non-negative/);
  assert.throws(() => new Ellipse("e", 0, 0, 0, -1), /ry must be non-negative/);
  assert.throws(() => new Rect("r", NaN, 0, 1, 1), /invalid number/);
  const line = new Line("l", 1, 2, Number.MAX_VALUE, 4);
  assert.throws(() => line.move(Number.MAX_VALUE, 0), /invalid number/);
  assert.equal(line.attributes().x1, "1");
  assert.throws(() => line.scale(2), /invalid number/);
  assert.equal(line.attributes().x1, "1");
  for (const factor of [0, -1, Infinity, NaN]) {
    assert.throws(() => line.scale(factor), /scale factor must be positive/);
  }
});

test("Composite applies move, scale and inheritance styles to nested groups", () => {
  const outer = new Group("outer");
  const inner = new Group("inner");
  const rect = new Rect("r", 1, 2, 3, 4);
  const text = new Text("t", 5, 6, "文字");
  outer.insert(inner);
  inner.insert(rect);
  inner.insert(text);
  outer.move(10, 20);
  outer.scale(2);
  outer.setAttribute("fill", "red");
  assert.equal(rect.attributes().x, "22");
  assert.equal(text.attributes().y, "52");
  assert.equal(outer.attributes().fill, "red");
  assert.equal(rect.attributes().fill, undefined);
  assert.equal(rect.parent, inner);
  assert.throws(() => rect.asContainer(), /not a container: r/);
  const children = inner.children as Array<Rect | Text>;
  children.pop();
  assert.equal(inner.children.length, 2);
});

test("factory creation and SVG import share types and preserve visual metadata", () => {
  const factory = new ShapeFactory();
  assert.equal(factory.create("g", "g", []).isContainer(), true);
  assert.equal(factory.create("text", "t", ["1.5", "2", "hello world"]).text, "hello world");
  assert.equal(factory.create("rect", "r", ["1", "2", "3", "4"]).attributes().fill, undefined);
  assert.throws(() => factory.create("box", "b", []), /unknown shape type: box \(is the plugin loaded\?\)/);
  assert.throws(() => factory.create("circle", "c", ["1"]), /invalid parameters for circle/);
  const imported = factory.fromSvg("text", "t", {
    id: "ignored", x: "1", y: "2", "font-size": "16", "text-anchor": "middle", transform: "translate(2,3)",
  }, "中文 & text");
  assert.equal(imported.id, "t");
  assert.equal(imported.attributes()["font-size"], "16");
  assert.equal(imported.clone().attributes().transform, "translate(2,3)");
  assert.equal(imported.clone().text, "中文 & text");
  assert.throws(() => imported.setAttribute("font-size", "20"), /unknown attribute: font-size/);
});

test("grouping siblings follows original order and replaces the first selected position", () => {
  const document = new SvgDocument();
  for (const id of ["a", "b", "c", "d"]) document.add(new Rect(id, 0, 0, 1, 1));
  document.group("g", ["d", "b"]);
  assert.deepEqual(document.root.children.map(shape => shape.id), ["a", "g", "c"]);
  assert.deepEqual(document.find("g").children.map(shape => shape.id), ["b", "d"]);
  assert.equal(document.count(), 5);
});

test("cross-parent grouping preserves document traversal order at root end", () => {
  const document = new SvgDocument();
  document.add(new Group("left"));
  document.add(new Group("right"));
  document.add(new Rect("a", 0, 0, 1, 1), "left");
  document.add(new Rect("b", 0, 0, 1, 1), "right");
  document.group("together", ["b", "a"]);
  assert.deepEqual(document.root.children.map(shape => shape.id), ["left", "right", "together"]);
  assert.deepEqual(document.find("together").children.map(shape => shape.id), ["a", "b"]);
});

test("tree changes reject ancestor selection and cycles before changing relationships", () => {
  const document = new SvgDocument();
  document.add(new Group("outer"));
  document.add(new Group("inner"), "outer");
  document.add(new Rect("r", 0, 0, 1, 1), "inner");
  assert.throws(() => document.group("bad", ["r", "outer"]), /cannot group a container into its own descendant: outer/);
  assert.throws(() => document.addTo("inner", "outer"), /cannot group a container into its own descendant: outer/);
  assert.throws(() => document.addTo("inner", "inner"), /cannot group a container into its own descendant: inner/);
  assert.equal(document.count(), 3);
  assert.equal(document.find("inner").parent?.id, "outer");
  assert.equal(document.find("outer").parent, document.root);
});

test("ungroup lifts nested children into the original position; top-level is protected", () => {
  const document = new SvgDocument();
  document.add(new Group("outer"));
  document.add(new Rect("before", 0, 0, 1, 1), "outer");
  document.add(new Group("inner"), "outer");
  document.add(new Rect("after", 0, 0, 1, 1), "outer");
  document.add(new Rect("a", 0, 0, 1, 1), "inner");
  document.add(new Rect("b", 0, 0, 1, 1), "inner");
  document.ungroup("inner");
  assert.deepEqual(document.find("outer").children.map(shape => shape.id), ["before", "a", "b", "after"]);
  assert.equal(document.find("a").parent?.id, "outer");
  assert.throws(() => document.find("inner"), /no such shape: inner/);
  assert.throws(() => document.ungroup("outer"), /cannot ungroup top-level container: outer/);
});

test("front/back and reparent affect only sibling ordering", () => {
  const document = new SvgDocument();
  document.add(new Group("g"));
  for (const id of ["a", "b", "c"]) document.add(new Rect(id, 0, 0, 1, 1), "g");
  document.front("a");
  assert.deepEqual(document.find("g").children.map(shape => shape.id), ["b", "c", "a"]);
  document.back("a");
  assert.deepEqual(document.find("g").children.map(shape => shape.id), ["a", "b", "c"]);
  document.addTo("g", "b");
  assert.deepEqual(document.find("g").children.map(shape => shape.id), ["a", "c", "b"]);
});

test("document enforces ids including subtrees and validates targets before mutation", () => {
  const document = new SvgDocument();
  document.add(new Rect("r", 0, 0, 1, 1));
  const group = new Group("g");
  group.insert(new Circle("r", 0, 0, 1));
  assert.throws(() => document.add(group), /id already exists: r/);
  assert.equal(group.parent, null);
  assert.equal(document.count(), 1);
  assert.throws(() => document.add(new Group("new"), "missing"), /no such container: missing/);
  assert.throws(() => document.add(new Group("new"), "r"), /not a container: r/);
  assert.throws(() => document.group("r", ["missing"]), /id already exists: r/);
  assert.throws(() => document.find("__svg_root__"), /no such shape: __svg_root__/);
});

test("clones are independent snapshots, retaining parents, metadata and document dimensions", () => {
  const document = new SvgDocument(400, 300, { viewBox: "10 20 40 30", style: "background:white" });
  const group = new Group("g");
  group.importAttributes({ transform: "translate(5,6)", "data-kind": "box" });
  document.add(group);
  document.add(new Text("t", 1, 2, "hello"), "g");
  const copy = document.clone();
  copy.find("t").setAttribute("text", "changed");
  copy.find("g").move(10, 10);
  copy.delete("g");
  assert.equal(copy.count(), 0);
  assert.equal(document.find("t").text, "hello");
  assert.equal(document.find("t").attributes().x, "1");
  assert.equal(document.find("t").parent, group);
  assert.equal(document.rootAttributes().viewBox, "10 20 40 30");
  assert.equal(document.clone().rootAttributes().style, "background:white");
  assert.throws(() => document.resize(0, 100), /canvas width must be positive/);
  assert.equal(document.width, 400);
  document.resize(200, 150);
  assert.equal(document.rootAttributes().viewBox, "0 0 200 150");
});
