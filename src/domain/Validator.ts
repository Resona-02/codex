/** 集中表达数值约束；几何行为仍由各图形自己负责。 */
export class Validator {
  static number(value: string): number {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
      throw new Error(`invalid number: ${value}`);
    }
    return this.finite(Number(value));
  }

  static finite(value: number): number {
    if (!Number.isFinite(value)) throw new Error(`invalid number: ${value}`);
    return value;
  }

  static nonNegative(value: number, name: string): number {
    this.finite(value);
    if (value < 0) throw new Error(`${name} must be non-negative`);
    return value;
  }

  static positive(value: number, name: string): number {
    this.finite(value);
    if (value <= 0) throw new Error(`${name} must be positive`);
    return value;
  }

  static scale(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("scale factor must be positive");
    }
    return value;
  }

  static id(value: string): void {
    if (value.trim() === "" || /\s/.test(value)) {
      throw new Error(`invalid id: ${value}`);
    }
  }
}
