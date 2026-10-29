import { DOMImplementation, DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document as XmlDocument, Element as XmlElement, Node as XmlNode } from "@xmldom/xmldom";
import type { LoadedDocument } from "../application/DocumentStore.js";
import { Group } from "../domain/Group.js";
import { Numbers } from "../domain/Numbers.js";
import type { Shape } from "../domain/Shape.js";
import { ShapeFactory } from "../domain/ShapeFactory.js";
import { SvgDocument } from "../domain/SvgDocument.js";
import { SvgTransform } from "./SvgTransform.js";

export class SvgCodec {
  private readonly namespace = "http://www.w3.org/2000/svg";
  private readonly factory = new ShapeFactory();

  decode(source: string): LoadedDocument {
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("invalid SVG: DTD and entity declarations are not supported");
    let xml: XmlDocument;
    try {
      xml = new DOMParser({ onError: (_level, message) => { throw new Error(message); } })
        .parseFromString(source, "application/xml");
    } catch {
      throw new Error("invalid SVG: malformed XML");
    }
    const root = xml.documentElement;
    if (!root || root.localName !== "svg") throw new Error("invalid SVG: expected <svg> root");
    this.checkNamespace(root);
    this.checkContainerText(root);
    const attributes = this.attributes(root);
    const rootExtras = { ...attributes };
    for (const key of ["xmlns", "width", "height", "transform"]) delete rootExtras[key];
    const presentation = { ...rootExtras };
    for (const key of ["viewBox", "id", "version", "preserveAspectRatio"]) delete presentation[key];
    new Group("__validation__").importPresentation(presentation);

    const box = attributes.viewBox?.trim().split(/[\s,]+/).map(value => Numbers.parse(value, "viewBox"));
    if (box && (box.length !== 4 || box[2]! <= 0 || box[3]! <= 0)) throw new Error("invalid SVG viewBox");
    const width = Numbers.parse((attributes.width ?? String(box?.[2] ?? 800)).replace(/px$/, ""), "width");
    const height = Numbers.parse((attributes.height ?? String(box?.[3] ?? 600)).replace(/px$/, ""), "height");
    const document = new SvgDocument(width, height, rootExtras);

    // Reserve ALL explicit IDs first; an unnamed rect must not steal a later rect1.
    const reserved = new Set<string>();
    for (const element of [root, ...Array.from(root.getElementsByTagName("*"))]) {
      const id = element.getAttribute("id");
      if (!id) continue;
      if (reserved.has(id)) throw new Error(`id already exists: ${id}`);
      reserved.add(id);
    }
    const warnings: string[] = [];
    const transform = SvgTransform.parse(attributes.transform);
    const inherited = { fontSize: attributes["font-size"] ?? "16", strokeWidth: attributes["stroke-width"] ?? "1" };
    for (const element of this.elements(root)) {
      document.add(this.decodeShape(element, reserved, warnings, transform, inherited));
    }
    return { document, warnings };
  }

  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(this.namespace, "svg", null);
    const root = xml.documentElement!;
    for (const [name, value] of Object.entries(document.getRootAttributes())) root.setAttribute(name, value);
    for (const shape of document.getChildren()) {
      root.appendChild(xml.createTextNode("\n  "));
      root.appendChild(this.encodeShape(xml, shape, 1));
    }
    if (document.getChildren().length) root.appendChild(xml.createTextNode("\n"));
    // XML parsers normalize literal CR; character references preserve the text on read.
    const serialized = new XMLSerializer().serializeToString(xml).replace(/\r/g, "&#13;");
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized + "\n";
  }

  private decodeShape(
    element: XmlElement, reserved: Set<string>, warnings: string[],
    parentTransform: SvgTransform, inherited: { fontSize: string; strokeWidth: string },
  ): Shape {
    this.checkNamespace(element);
    const type = element.localName ?? element.tagName;
    const attributes = this.attributes(element);
    let id = attributes.id;
    if (!id) {
      let sequence = 1;
      while (reserved.has(`${type}${sequence}`)) sequence++;
      id = `${type}${sequence}`;
      reserved.add(id);
      warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
    }
    const transform = parentTransform.compose(SvgTransform.parse(attributes.transform));
    delete attributes.transform;
    delete attributes.xmlns;
    const style = {
      fontSize: attributes["font-size"] ?? inherited.fontSize,
      strokeWidth: attributes["stroke-width"] ?? inherited.strokeWidth,
    };
    const shape = this.factory.fromSvg(type, id, attributes, element.textContent ?? "");
    const children = this.elements(element);
    if (shape instanceof Group) {
      this.checkContainerText(element);
      for (const child of children) shape.insert(this.decodeShape(child, reserved, warnings, transform, style));
    } else {
      if (children.length > 0) throw new Error(`unsupported nested SVG element in <${type}>`);
      if (shape.getText() === undefined) this.checkContainerText(element);
      shape.scale(transform.scale());
      shape.move(transform.x(), transform.y());
      if (transform.scale() !== 1) {
        const stroke = Numbers.nonNegative(Numbers.parse(style.strokeWidth.replace(/px$/, ""), "stroke-width"), "stroke-width");
        shape.setAttribute("stroke-width", Numbers.format(stroke * transform.scale()));
        if (shape.getText() !== undefined) {
          const size = Numbers.nonNegative(Numbers.parse(style.fontSize.replace(/px$/, ""), "font-size"), "font-size");
          shape.importPresentation({ "font-size": Numbers.format(size * transform.scale()) });
        }
      }
    }
    return shape;
  }

  private encodeShape(xml: XmlDocument, shape: Shape, depth: number): XmlElement {
    const element = xml.createElementNS(this.namespace, shape.getTag());
    for (const [name, value] of Object.entries(shape.getAttributes())) element.setAttribute(name, value);
    const text = shape.getText();
    if (text !== undefined) element.appendChild(xml.createTextNode(text));
    for (const child of shape.getChildren()) {
      element.appendChild(xml.createTextNode("\n" + "  ".repeat(depth + 1)));
      element.appendChild(this.encodeShape(xml, child, depth + 1));
    }
    if (shape.getChildren().length) element.appendChild(xml.createTextNode("\n" + "  ".repeat(depth)));
    return element;
  }

  private attributes(element: XmlElement): Record<string, string> {
    return Object.fromEntries(Array.from(element.attributes).map(attribute => [attribute.name, attribute.value]));
  }

  private elements(node: XmlNode): XmlElement[] {
    return Array.from(node.childNodes).filter((child): child is XmlElement => child.nodeType === 1);
  }

  private checkNamespace(element: XmlElement): void {
    if (element.namespaceURI && element.namespaceURI !== this.namespace) throw new Error("invalid SVG namespace");
  }

  private checkContainerText(element: XmlElement): void {
    if (Array.from(element.childNodes).some(node => [3, 4].includes(node.nodeType) && node.nodeValue?.trim())) {
      throw new Error(`unexpected text inside <${element.localName}>`);
    }
  }
}

