import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

export class Rect extends Shape {
  #x: number;
  #y: number;
  #width: number;
  #height: number;

  constructor(id: string, x: number, y: number, width: number, height: number, fill?: string) {
    super(id);
    this.#x = Validator.finite(x);
    this.#y = Validator.finite(y);
    this.#width = Validator.nonNegative(width, "width");
    this.#height = Validator.nonNegative(height, "height");
    if (fill !== undefined) this.setAttribute("fill", fill);
  }

  override get tag(): string { return "rect"; }

  override move(dx: number, dy: number): void {
    const x = Validator.finite(this.#x + Validator.finite(dx));
    const y = Validator.finite(this.#y + Validator.finite(dy));
    this.#x = x;
    this.#y = y;
  }

  override scale(factor: number): void {
    Validator.scale(factor);
    const values = [this.#x, this.#y, this.#width, this.#height]
      .map(value => Validator.finite(value * factor));
    [this.#x, this.#y, this.#width, this.#height] = values as [number, number, number, number];
  }

  protected override geometryAttributes(): Record<string, string> {
    return { x: String(this.#x), y: String(this.#y), width: String(this.#width), height: String(this.#height) };
  }

  protected override setGeometryAttribute(attribute: string, value: string): boolean {
    if (attribute === "x") this.#x = Validator.number(value);
    else if (attribute === "y") this.#y = Validator.number(value);
    else if (attribute === "width") this.#width = Validator.nonNegative(Validator.number(value), attribute);
    else if (attribute === "height") this.#height = Validator.nonNegative(Validator.number(value), attribute);
    else return false;
    return true;
  }

  protected override geometrySummary(): string {
    return `x=${this.#x} y=${this.#y} w=${this.#width} h=${this.#height}`;
  }

  override clone(): Rect {
    const clone = new Rect(this.id, this.#x, this.#y, this.#width, this.#height);
    this.copyAttributesTo(clone);
    return clone;
  }
}
