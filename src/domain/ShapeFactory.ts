import { Circle } from "./Circle.js";
import { Ellipse } from "./Ellipse.js";
import { Group } from "./Group.js";
import { Line } from "./Line.js";
import { Numbers } from "./Numbers.js";
import { Rect } from "./Rect.js";
import type { Shape } from "./Shape.js";
import { Text } from "./Text.js";

interface ShapeDefinition {
  readonly geometry: readonly string[];
  readonly construct: (id: string, values: readonly number[], text: string) => Shape;
  readonly optionalStyle?: "fill" | "stroke";
  readonly hasText?: boolean;
}

export class ShapeFactory {
  // One of the two name-dispatch points. TODO (plugin phase): provider registration.
  private readonly definitions = new Map<string, ShapeDefinition>([
    ["rect", { geometry: ["x", "y", "width", "height"], optionalStyle: "fill",
      construct: (id, v) => new Rect(id, v[0]!, v[1]!, v[2]!, v[3]!) }],
    ["circle", { geometry: ["cx", "cy", "r"], optionalStyle: "fill",
      construct: (id, v) => new Circle(id, v[0]!, v[1]!, v[2]!) }],
    ["ellipse", { geometry: ["cx", "cy", "rx", "ry"], optionalStyle: "fill",
      construct: (id, v) => new Ellipse(id, v[0]!, v[1]!, v[2]!, v[3]!) }],
    ["line", { geometry: ["x1", "y1", "x2", "y2"], optionalStyle: "stroke",
      construct: (id, v) => new Line(id, v[0]!, v[1]!, v[2]!, v[3]!) }],
    ["text", { geometry: ["x", "y"], hasText: true,
      construct: (id, v, text) => new Text(id, v[0]!, v[1]!, text) }],
    ["g", { geometry: [], construct: id => new Group(id) }],
  ]);

  create(type: string, id: string, parameters: readonly string[]): Shape {
    const definition = this.definition(type);
    const required = definition.geometry.length + (definition.hasText ? 1 : 0);
    const max = required + (definition.optionalStyle ? 1 : 0);
    if (parameters.length < required || parameters.length > max) throw new Error(`invalid parameters for ${type}`);
    const values = definition.geometry.map((key, index) => Numbers.parse(parameters[index]!, key));
    const shape = definition.construct(id, values, definition.hasText ? parameters[values.length]! : "");
    if (definition.optionalStyle && parameters.length > required) {
      shape.setAttribute(definition.optionalStyle, parameters[required]!);
    }
    return shape;
  }

  fromSvg(type: string, id: string, attributes: Readonly<Record<string, string>>, text: string): Shape {
    const definition = this.definition(type);
    const values = definition.geometry.map(key => Numbers.parse((attributes[key] ?? "0").replace(/px$/, ""), key));
    const shape = definition.construct(id, values, text);
    const presentation = Object.fromEntries(Object.entries(attributes)
      .filter(([key]) => key !== "id" && !definition.geometry.includes(key)));
    shape.importPresentation(presentation);
    return shape;
  }

  private definition(type: string): ShapeDefinition {
    const definition = this.definitions.get(type);
    if (!definition) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}

