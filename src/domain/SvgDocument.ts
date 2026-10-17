import { Group } from "./Group.js";
import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

/** 聚合根负责文档级不变量：唯一 id、树结构、层叠顺序与画布。 */
export class SvgDocument {
  readonly #root = new Group("__svg_root__");
  #width: number;
  #height: number;
  readonly #rootAttributes: Record<string, string>;

  constructor(width = 800, height = 600, attributes: Readonly<Record<string, string>> = {}) {
    this.#width = Validator.positive(width, "canvas width");
    this.#height = Validator.positive(height, "canvas height");
    this.#rootAttributes = {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      ...attributes,
    };
    if (this.#rootAttributes.id !== undefined) Validator.id(this.#rootAttributes.id);
  }

  get root(): Group { return this.#root; }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }

  rootAttributes(): Readonly<Record<string, string>> {
    return { ...this.#rootAttributes, width: String(this.#width), height: String(this.#height) };
  }

  resize(width: number, height: number): void {
    Validator.positive(width, "canvas width");
    Validator.positive(height, "canvas height");
    this.#width = width;
    this.#height = height;
    this.#rootAttributes.viewBox = `0 0 ${width} ${height}`;
  }

  find(id: string): Shape {
    const shape = this.allShapes().find(candidate => candidate.id === id);
    if (shape === undefined) throw new Error(`no such shape: ${id}`);
    return shape;
  }

  findContainer(id: string): Group {
    const shape = this.allShapes().find(candidate => candidate.id === id);
    if (shape === undefined) throw new Error(`no such container: ${id}`);
    return shape.asContainer();
  }

  ensureAvailableId(id: string): void {
    Validator.id(id);
    if (this.#rootAttributes.id === id || this.allShapes().some(shape => shape.id === id)) {
      throw new Error(`id already exists: ${id}`);
    }
  }

  add(shape: Shape, parentId?: string): void {
    const parent = parentId === undefined ? this.#root : this.findContainer(parentId);
    const existingIds = new Set(this.allShapes().map(existing => existing.id));
    if (this.#rootAttributes.id !== undefined) existingIds.add(this.#rootAttributes.id);
    const pending = [shape];
    while (pending.length > 0) {
      const candidate = pending.pop()!;
      if (existingIds.has(candidate.id)) throw new Error(`id already exists: ${candidate.id}`);
      existingIds.add(candidate.id);
      pending.push(...candidate.children);
    }
    parent.insert(shape);
  }

  delete(id: string): void {
    const shape = this.find(id);
    shape.parent!.remove(shape);
  }

  group(newId: string, ids: readonly string[]): void {
    this.ensureAvailableId(newId);
    if (ids.length === 0) throw new Error("group requires at least one shape");
    if (new Set(ids).size !== ids.length) throw new Error("group ids must be distinct");
    const selected = new Set(ids.map(id => this.find(id)));
    for (const shape of selected) {
      for (let ancestor = shape.parent; ancestor !== null && ancestor !== this.#root; ancestor = ancestor.parent) {
        if (selected.has(ancestor)) {
          throw new Error(`cannot group a container into its own descendant: ${ancestor.id}`);
        }
      }
    }
    // 以原文档遍历顺序为准，而不是命令参数的排列顺序。
    const ordered = this.allShapes().filter(shape => selected.has(shape));
    const firstParent = ordered[0]!.parent!;
    const sameParent = ordered.every(shape => shape.parent === firstParent);
    const parent = sameParent ? firstParent : this.#root;
    const index = sameParent ? parent.children.indexOf(ordered[0]!) : parent.children.length;
    const group = new Group(newId);
    parent.insert(group, index);
    for (const shape of ordered) group.insert(shape);
  }

  ungroup(id: string): void {
    const group = this.find(id).asContainer();
    const parent = group.parent!;
    if (parent === this.#root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const attributes = group.attributes();
    const inheritedStyles = ["fill", "stroke", "stroke-width"];
    const unsupported = Object.keys(attributes).find(attribute =>
      attribute !== "id" && !inheritedStyles.includes(attribute) && !attribute.startsWith("data-"));
    if (unsupported !== undefined) {
      throw new Error(`cannot ungroup container with unsupported attribute: ${id} (${unsupported})`);
    }
    const updates = group.children.map(child => {
      const ownAttributes = child.attributes();
      const inherited = inheritedStyles.filter(attribute =>
        attributes[attribute] !== undefined && (ownAttributes[attribute] === undefined ||
          ["inherit", "unset"].includes(ownAttributes[attribute]!.trim())));
      if (ownAttributes.style !== undefined && inheritedStyles.some(attribute => attributes[attribute] !== undefined)) {
        throw new Error(`cannot ungroup container with an inline-styled child: ${id} (${child.id})`);
      }
      return { child, inherited };
    });
    // 摘掉 g 前先落实其可安全继承的样式，避免改变提升后子节点的外观。
    for (const { child, inherited } of updates) {
      for (const attribute of inherited) child.setAttribute(attribute, attributes[attribute]!);
    }
    const index = parent.remove(group);
    for (const [offset, child] of group.children.entries()) parent.insert(child, index + offset);
  }

  addTo(groupId: string, id: string): void {
    const group = this.findContainer(groupId);
    const shape = this.find(id);
    group.insert(shape);
  }

  front(id: string): void {
    const shape = this.find(id);
    shape.parent!.insert(shape);
  }

  back(id: string): void {
    const shape = this.find(id);
    shape.parent!.insert(shape, 0);
  }

  count(): number { return this.allShapes().length; }

  allShapes(): readonly Shape[] {
    const shapes: Shape[] = [];
    const pending = [...this.#root.children].reverse();
    while (pending.length > 0) {
      const shape = pending.pop()!;
      shapes.push(shape);
      pending.push(...[...shape.children].reverse());
    }
    return shapes;
  }

  clone(): SvgDocument {
    const clone = new SvgDocument(this.#width, this.#height, this.#rootAttributes);
    for (const shape of this.#root.children) clone.add(shape.clone());
    return clone;
  }
}
