import { Shape } from "./Shape.js";
import { Validator } from "./Validator.js";

export class Ellipse extends Shape {
  #cx: number;
  #cy: number;
  #rx: number;
  #ry: number;

  constructor(id: string, cx: number, cy: number, rx: number, ry: number, fill?: string) {
    super(id);
    this.#cx = Validator.finite(cx);
    this.#cy = Validator.finite(cy);
    this.#rx = Validator.nonNegative(rx, "rx");
    this.#ry = Validator.nonNegative(ry, "ry");
    if (fill !== undefined) this.setAttribute("fill", fill);
  }

  override get tag(): string { return "ellipse"; }

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
    const values = [this.#cx, this.#cy, this.#rx, this.#ry]
      .map(value => Validator.finite(value * factor));
    [this.#cx, this.#cy, this.#rx, this.#ry] = values as [number, number, number, number];
  }

  protected override geometryAttributes(): Record<string, string> {
    return { cx: String(this.#cx), cy: String(this.#cy), rx: String(this.#rx), ry: String(this.#ry) };
  }

  protected override setGeometryAttribute(attribute: string, value: string): boolean {
    if (attribute === "cx") this.#cx = Validator.number(value);
    else if (attribute === "cy") this.#cy = Validator.number(value);
    else if (attribute === "rx") this.#rx = Validator.nonNegative(Validator.number(value), attribute);
    else if (attribute === "ry") this.#ry = Validator.nonNegative(Validator.number(value), attribute);
    else return false;
    return true;
  }

  protected override geometrySummary(): string {
    return `cx=${this.#cx} cy=${this.#cy} rx=${this.#rx} ry=${this.#ry}`;
  }

  override clone(): Ellipse {
    const clone = new Ellipse(this.id, this.#cx, this.#cy, this.#rx, this.#ry);
    this.copyAttributesTo(clone);
    return clone;
  }
}
