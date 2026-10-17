import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

/** 组合节点把统一操作递归交给子节点，不按具体类型分派。 */
export class Group extends Shape {
  readonly #children: Shape[] = [];

  constructor(id: string) { super(id); }

  override get tag(): string { return "g"; }
  override get children(): readonly Shape[] { return [...this.#children]; }
  override isContainer(): boolean { return true; }
  override asContainer(): Group { return this; }

  insert(shape: Shape, index = this.#children.length): void {
    for (let ancestor: Shape | null = this; ancestor !== null; ancestor = ancestor.parent) {
      if (ancestor === shape) {
        throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
      }
    }
    if (!Number.isInteger(index) || index < 0 || index > this.#children.length) {
      throw new Error(`invalid child index: ${index}`);
    }
    const oldIndex = shape.parent === this ? this.#children.indexOf(shape) : -1;
    shape.parent?.remove(shape);
    // index 基于移除前的序列；末尾插入和同组重排仍保持直观语义。
    const targetIndex = oldIndex >= 0 && oldIndex < index ? index - 1 : index;
    this.#children.splice(targetIndex, 0, shape);
    shape.setParent(this);
  }

  remove(shape: Shape): number {
    const index = this.#children.indexOf(shape);
    if (index < 0) throw new Error(`no such child: ${shape.id}`);
    this.#children.splice(index, 1);
    shape.setParent(null);
    return index;
  }

  override move(dx: number, dy: number): void {
    Validator.finite(dx);
    Validator.finite(dy);
    for (const shape of this.#children) shape.move(dx, dy);
  }

  override scale(factor: number): void {
    Validator.scale(factor);
    for (const shape of this.#children) shape.scale(factor);
  }

  protected override geometryAttributes(): Record<string, string> { return {}; }
  protected override setGeometryAttribute(_attribute: string, _value: string): boolean { return false; }
  protected override geometrySummary(): string { return ""; }

  override clone(): Group {
    const clone = new Group(this.id);
    this.copyAttributesTo(clone);
    for (const child of this.#children) clone.insert(child.clone());
    return clone;
  }
}
