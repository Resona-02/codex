import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

export class Circle extends Shape {
  #cx: number;
  #cy: number;
  #r: number;

  constructor(id: string, cx: number, cy: number, r: number, fill?: string) {
    super(id);
    this.#cx = Validator.finite(cx);
    this.#cy = Validator.finite(cy);
    this.#r = Validator.nonNegative(r, "r");
    if (fill !== undefined) this.setAttribute("fill", fill);
  }

  override get tag(): string { return "circle"; }

  override move(dx: number, dy: number): void {
    const cx = Validator.finite(this.#cx + Validator.finite(dx));
    const cy = Validator.finite(this.#cy + Validator.finite(dy));
    this.#cx = cx;
    this.#cy = cy;
  }

  override rememberPosition(): () => void {
    const cx = this.#cx;
    const cy = this.#cy;
    return () => {
      this.#cx = cx;
      this.#cy = cy;
    };
  }

  override scale(factor: number): void {
    Validator.scale(factor);
    const values = [this.#cx, this.#cy, this.#r].map(value => Validator.finite(value * factor));
    [this.#cx, this.#cy, this.#r] = values as [number, number, number];
  }

  protected override geometryAttributes(): Record<string, string> {
    return { cx: String(this.#cx), cy: String(this.#cy), r: String(this.#r) };
  }

  protected override setGeometryAttribute(attribute: string, value: string): boolean {
    if (attribute === "cx") this.#cx = Validator.number(value);
    else if (attribute === "cy") this.#cy = Validator.number(value);
    else if (attribute === "r") this.#r = Validator.nonNegative(Validator.number(value), attribute);
    else return false;
    return true;
  }

  protected override geometrySummary(): string { return `cx=${this.#cx} cy=${this.#cy} r=${this.#r}`; }

  override clone(): Circle {
    const clone = new Circle(this.id, this.#cx, this.#cy, this.#r);
    this.copyAttributesTo(clone);
    return clone;
  }
}
