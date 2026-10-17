import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

export class Line extends Shape {
  #x1: number;
  #y1: number;
  #x2: number;
  #y2: number;

  constructor(id: string, x1: number, y1: number, x2: number, y2: number, stroke?: string) {
    super(id);
    this.#x1 = Validator.finite(x1);
    this.#y1 = Validator.finite(y1);
    this.#x2 = Validator.finite(x2);
    this.#y2 = Validator.finite(y2);
    if (stroke !== undefined) this.setAttribute("stroke", stroke);
  }

  override get tag(): string { return "line"; }

  override move(dx: number, dy: number): void {
    Validator.finite(dx);
    Validator.finite(dy);
    const x1 = Validator.finite(this.#x1 + dx);
    const y1 = Validator.finite(this.#y1 + dy);
    const x2 = Validator.finite(this.#x2 + dx);
    const y2 = Validator.finite(this.#y2 + dy);
    this.#x1 = x1;
    this.#y1 = y1;
    this.#x2 = x2;
    this.#y2 = y2;
  }

  override scale(factor: number): void {
    Validator.scale(factor);
    const values = [this.#x1, this.#y1, this.#x2, this.#y2]
      .map(value => Validator.finite(value * factor));
    [this.#x1, this.#y1, this.#x2, this.#y2] = values as [number, number, number, number];
  }

  protected override geometryAttributes(): Record<string, string> {
    return { x1: String(this.#x1), y1: String(this.#y1), x2: String(this.#x2), y2: String(this.#y2) };
  }

  protected override setGeometryAttribute(attribute: string, value: string): boolean {
    if (attribute === "x1") this.#x1 = Validator.number(value);
    else if (attribute === "y1") this.#y1 = Validator.number(value);
    else if (attribute === "x2") this.#x2 = Validator.number(value);
    else if (attribute === "y2") this.#y2 = Validator.number(value);
    else return false;
    return true;
  }

  protected override geometrySummary(): string {
    return `(${this.#x1},${this.#y1}) -> (${this.#x2},${this.#y2})`;
  }

  override clone(): Line {
    const clone = new Line(this.id, this.#x1, this.#y1, this.#x2, this.#y2);
    this.copyAttributesTo(clone);
    return clone;
  }
}
