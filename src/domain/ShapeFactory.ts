import { Circle } from "./Circle.js";
import { Ellipse } from "./Ellipse.js";
import { Group } from "./Group.js";
import { Line } from "./Line.js";
import { Rect } from "./Rect.js";
import { Shape } from "./Shape.js";
import { Text } from "./Text.js";
import { Validator } from "./Validator.js";

interface ShapeDefinition {
  readonly parameters: readonly string[];
  readonly optionalStyle?: string;
  readonly construct: (id: string, parameters: readonly string[]) => Shape;
}

/** 按类型名字分派的唯一入口；命令创建与 SVG 导入共享同一注册表。 */
export class ShapeFactory {
  readonly #definitions = new Map<string, ShapeDefinition>([
    ["rect", {
      parameters: ["x", "y", "width", "height"], optionalStyle: "fill",
      construct: (id, p) => new Rect(id, Validator.number(p[0]!), Validator.number(p[1]!),
        Validator.number(p[2]!), Validator.number(p[3]!), p[4]),
    }],
    ["circle", {
      parameters: ["cx", "cy", "r"], optionalStyle: "fill",
      construct: (id, p) => new Circle(id, Validator.number(p[0]!), Validator.number(p[1]!),
        Validator.number(p[2]!), p[3]),
    }],
    ["ellipse", {
      parameters: ["cx", "cy", "rx", "ry"], optionalStyle: "fill",
      construct: (id, p) => new Ellipse(id, Validator.number(p[0]!), Validator.number(p[1]!),
        Validator.number(p[2]!), Validator.number(p[3]!), p[4]),
    }],
    ["line", {
      parameters: ["x1", "y1", "x2", "y2"], optionalStyle: "stroke",
      construct: (id, p) => new Line(id, Validator.number(p[0]!), Validator.number(p[1]!),
        Validator.number(p[2]!), Validator.number(p[3]!), p[4]),
    }],
    ["text", {
      parameters: ["x", "y", "text"],
      construct: (id, p) => new Text(id, Validator.number(p[0]!), Validator.number(p[1]!), p[2]!),
    }],
    ["g", { parameters: [], construct: id => new Group(id) }],
  ]);

  create(type: string, id: string, parameters: readonly string[]): Shape {
    const definition = this.definition(type);
    const minimum = definition.parameters.length;
    const maximum = minimum + (definition.optionalStyle === undefined ? 0 : 1);
    if (parameters.length < minimum || parameters.length > maximum) {
      throw new Error(`invalid parameters for ${type}: expected ${minimum === maximum ? minimum : `${minimum}-${maximum}`}, got ${parameters.length}`);
    }
    return definition.construct(id, parameters);
  }

  fromSvg(type: string, id: string, attributes: Readonly<Record<string, string>>, text: string): Shape {
    const definition = this.definition(type);
    const parameters = definition.parameters.map(attribute => attribute === "text" ? text : attributes[attribute] ?? "0");
    if (definition.optionalStyle !== undefined && attributes[definition.optionalStyle] !== undefined) {
      parameters.push(attributes[definition.optionalStyle]!);
    }
    const shape = this.create(type, id, parameters);
    shape.importAttributes(attributes);
    return shape;
  }

  private definition(type: string): ShapeDefinition {
    const definition = this.#definitions.get(type);
    if (definition === undefined) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}
