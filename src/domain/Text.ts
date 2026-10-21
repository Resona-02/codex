import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

export class Text extends Shape {
  #x: number;
  #y: number;
  #content: string;

  constructor(id: string, x: number, y: number, content: string) {
    super(id);
    this.#x = Validator.finite(x);
    this.#y = Validator.finite(y);
    this.#content = content;
  }

  override get tag(): string { return "text"; }
  override get text(): string { return this.#content; }

  override move(dx: number, dy: number): void {
    const x = Validator.finite(this.#x + Validator.finite(dx));
    const y = Validator.finite(this.#y + Validator.finite(dy));
    this.#x = x;
    this.#y = y;
  }

  override rememberPosition(): () => void {
    const x = this.#x;
    const y = this.#y;
    return () => {
      this.#x = x;
      this.#y = y;
    };
  }

  override scale(factor: number): void {
    Validator.scale(factor);
    const x = Validator.finite(this.#x * factor);
    const y = Validator.finite(this.#y * factor);
    this.#x = x;
    this.#y = y;
  }

  protected override geometryAttributes(): Record<string, string> {
    return { x: String(this.#x), y: String(this.#y) };
  }

  protected override setGeometryAttribute(attribute: string, value: string): boolean {
    if (attribute === "x") this.#x = Validator.number(value);
    else if (attribute === "y") this.#y = Validator.number(value);
    else if (attribute === "text") this.#content = value;
    else return false;
    return true;
  }

  protected override geometrySummary(): string {
    return `(${this.#x},${this.#y}) ${JSON.stringify(this.#content)}`;
  }

  override clone(): Text {
    const clone = new Text(this.id, this.#x, this.#y, this.#content);
    this.copyAttributesTo(clone);
    return clone;
  }
}
