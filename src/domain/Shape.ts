import type { Group } from "./Group.js";
import { Validator } from "./Validator.js";

/** Composite 的共同接口：调用方无需根据图形类型决定如何编辑。 */
export abstract class Shape {
  readonly #id: string;
  #parent: Group | null = null;
  #fill: string | undefined;
  #stroke: string | undefined;
  #strokeWidth: number | undefined;
  readonly #importedAttributes = new Map<string, string>();

  protected constructor(id: string) {
    Validator.id(id);
    this.#id = id;
  }

  get id(): string { return this.#id; }
  abstract get tag(): string;
  get parent(): Group | null { return this.#parent; }
  get children(): readonly Shape[] { return []; }
  get text(): string | undefined { return undefined; }

  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract clone(): Shape;
  protected abstract geometryAttributes(): Record<string, string>;
  protected abstract setGeometryAttribute(attribute: string, value: string): boolean;
  protected abstract geometrySummary(): string;

  isContainer(): boolean { return false; }

  asContainer(): Group {
    throw new Error(`not a container: ${this.id}`);
  }

  setAttribute(attribute: string, value: string): void {
    if (attribute === "fill") this.#fill = value;
    else if (attribute === "stroke") this.#stroke = value;
    else if (attribute === "stroke-width") {
      this.#strokeWidth = Validator.nonNegative(Validator.number(value), attribute);
    } else if (!this.setGeometryAttribute(attribute, value)) {
      throw new Error(`unknown attribute: ${attribute}`);
    }
  }

  attributes(): Readonly<Record<string, string>> {
    const attributes: Record<string, string> = {
      ...Object.fromEntries(this.#importedAttributes),
      id: this.id,
      ...this.geometryAttributes(),
    };
    if (this.#fill !== undefined) attributes.fill = this.#fill;
    if (this.#stroke !== undefined) attributes.stroke = this.#stroke;
    if (this.#strokeWidth !== undefined) attributes["stroke-width"] = String(this.#strokeWidth);
    return attributes;
  }

  /** 保留导入文件的视觉属性，但不扩大 CLI set 白名单。 */
  importAttributes(attributes: Readonly<Record<string, string>>): void {
    const geometry = this.geometryAttributes();
    for (const [attribute, value] of Object.entries(attributes)) {
      if (attribute === "id") continue;
      if (Object.hasOwn(geometry, attribute) || ["fill", "stroke", "stroke-width"].includes(attribute)) {
        this.setAttribute(attribute, value);
      } else {
        this.#importedAttributes.set(attribute, value);
      }
    }
  }

  summary(): string {
    const attributes = this.attributes();
    const styles = ["fill", "stroke", "stroke-width"]
      .filter(attribute => attributes[attribute] !== undefined)
      .map(attribute => `${attribute}=${attributes[attribute]}`);
    return [`${this.tag}#${this.id}`, this.geometrySummary(), ...styles].filter(Boolean).join(" ");
  }

  /** @internal 仅 Group 的插入/移除操作使用；验证双向关系已正确更新。 */
  setParent(parent: Group | null): void {
    if (parent !== null && !parent.children.includes(this)) {
      throw new Error("parent must contain its child");
    }
    if (this.#parent !== null && this.#parent !== parent && this.#parent.children.includes(this)) {
      throw new Error("remove child from its old parent first");
    }
    this.#parent = parent;
  }

  protected copyAttributesTo(shape: Shape): void {
    shape.importAttributes(this.attributes());
  }
}
