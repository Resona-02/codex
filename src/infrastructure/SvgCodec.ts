import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { Group } from '../domain/Group.js';
import { Shape } from '../domain/Shape.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';
import { SvgDocument } from '../domain/SvgDocument.js';

/** Converts between SVG XML and the object model; file access stays in SvgFileStore. */
export class SvgCodec {
  private readonly namespace = 'http://www.w3.org/2000/svg';

  constructor(private readonly factory = new ShapeFactory()) {}

  decode(xml: string): { document: SvgDocument; warnings: string[] } {
    const parsed = this.parseXml(xml);
    const root = parsed.documentElement;
    if (!root || root.localName !== 'svg' || !this.isSvgElement(root)) {
      throw new Error('invalid SVG: expected an <svg> root');
    }
    this.validateDocumentNodes(parsed);
    const width = this.dimension(root.getAttribute('width'), 800, 'width');
    const height = this.dimension(root.getAttribute('height'), 600, 'height');
    this.validateViewBox(root.getAttribute('viewBox'));

    const document = new SvgDocument(width, height, this.readAttributes(root));
    const usedIds = new Set<string>();
    this.collectIds(root, usedIds);
    const warnings: string[] = [];
    for (const element of this.elementChildren(root)) {
      document.add(this.decodeShape(element, usedIds, warnings));
    }
    return { document, warnings };
  }

  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(this.namespace, 'svg', null);
    const root = xml.documentElement!;
    for (const [name, value] of Object.entries(document.rootAttributes())) root.setAttribute(name, value);
    for (const shape of document.root.children) this.appendShape(xml, root, shape, 1);
    if (document.root.children.length > 0) root.appendChild(xml.createTextNode('\n'));
    const encoded = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(xml)}\n`;
    // Validate every serialized value before SvgFileStore creates or replaces a file.
    this.validateXmlCharacters(encoded);
    return encoded;
  }

  private parseXml(xml: string): Document {
    const markup = xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    // DTDs and custom entities are outside this editor's format, including external entities.
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(markup)) {
      throw new Error('invalid SVG: DOCTYPE and entity declarations are not supported');
    }
    if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(markup)) {
      throw new Error('invalid SVG: malformed XML entity');
    }
    if (markup.replace(/<(?:[^"'<>]|"[^"<>]*"|'[^'<>]*')*>/g, '').includes(']]>')) {
      throw new Error('invalid SVG: unexpected CDATA closing sequence');
    }
    for (const match of markup.matchAll(/&#(x[0-9a-fA-F]+|\d+);/g)) {
      const code = match[1]!.startsWith('x') ? parseInt(match[1]!.slice(1), 16) : Number(match[1]);
      if (!this.isXmlCharacter(code)) throw new Error('invalid SVG: invalid XML character reference');
    }
    this.validateXmlCharacters(xml);
    try {
      return new DOMParser({
        onError: () => { throw new Error('malformed XML'); },
      }).parseFromString(xml, 'application/xml');
    } catch {
      throw new Error('invalid SVG: malformed XML');
    }
  }

  private validateDocumentNodes(document: Document): void {
    for (let node = document.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 1 || node.nodeType === 8) continue;
      if (node.nodeType === 3 && !node.nodeValue?.trim()) continue;
      if (node.nodeType === 7 && node.nodeName.toLowerCase() === 'xml') continue;
      throw new Error('invalid SVG: unsupported content outside root');
    }
  }

  private dimension(value: string | null, fallback: number, name: string): number {
    if (value === null) return fallback;
    const trimmed = value.trim();
    if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px)?$/.test(trimmed)) {
      throw new Error(`invalid SVG: ${name} must be a positive number in px`);
    }
    const result = Number(trimmed.replace(/px$/, ''));
    if (!Number.isFinite(result) || result <= 0) {
      throw new Error(`invalid SVG: ${name} must be a positive number in px`);
    }
    return result;
  }

  private validateViewBox(value: string | null): void {
    if (value === null) return;
    const tokens = value.trim().split(/[\s,]+/);
    if (tokens.some(token => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))) {
      throw new Error('invalid SVG: viewBox must contain four numbers with positive width and height');
    }
    const values = tokens.map(Number);
    if (values.length !== 4 || values.some(number => !Number.isFinite(number)) ||
      values[2] <= 0 || values[3] <= 0) {
      throw new Error('invalid SVG: viewBox must contain four numbers with positive width and height');
    }
  }

  private collectIds(element: Element, usedIds: Set<string>): void {
    if (element.hasAttribute('id')) {
      const id = element.getAttribute('id')!;
      if (!id || /\s/.test(id)) throw new Error('invalid SVG: id must not be empty or contain whitespace');
      if (usedIds.has(id)) throw new Error(`id already exists: ${id}`);
      usedIds.add(id);
    }
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) this.collectIds(child as Element, usedIds);
    }
  }

  private decodeShape(element: Element, usedIds: Set<string>, warnings: string[]): Shape {
    if (!this.isSvgElement(element)) throw new Error(`invalid SVG: unsupported namespace: ${element.namespaceURI}`);
    const attributes = this.readAttributes(element);
    const type = element.localName ?? element.tagName;
    let id = element.getAttribute('id');
    if (id === null) {
      let sequence = 1;
      while (usedIds.has(`${type}${sequence}`)) sequence++;
      id = `${type}${sequence}`;
      usedIds.add(id);
      warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
    }
    const shape = this.factory.fromSvg(type, id, attributes, element.textContent ?? '');
    if (shape instanceof Group) {
      for (const child of this.elementChildren(element)) {
        shape.insert(this.decodeShape(child, usedIds, warnings));
      }
    } else {
      for (let node = element.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 8) continue;
        if ((node.nodeType === 3 || node.nodeType === 4) &&
          (shape.text !== undefined || !node.nodeValue?.trim())) continue;
        throw new Error(`invalid SVG: unsupported child content in <${type}>`);
      }
    }
    return shape;
  }

  private elementChildren(parent: Node): Element[] {
    const elements: Element[] = [];
    for (let node = parent.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 1) elements.push(node as Element);
      else if (node.nodeType !== 8 && !(node.nodeType === 3 && !node.nodeValue?.trim())) {
        throw new Error(`invalid SVG: unsupported content in <${parent.nodeName}>`);
      }
    }
    return elements;
  }

  private isSvgElement(element: Element): boolean {
    return element.namespaceURI === this.namespace ||
      (!element.namespaceURI && !element.hasAttribute('xmlns'));
  }

  private isXmlCharacter(code: number): boolean {
    return code === 9 || code === 10 || code === 13 ||
      (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
  }

  private validateXmlCharacters(value: string): void {
    for (const character of value) {
      if (!this.isXmlCharacter(character.codePointAt(0)!)) {
        throw new Error('invalid SVG: invalid XML character');
      }
    }
  }

  private readAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let index = 0; index < element.attributes.length; index++) {
      const attribute = element.attributes.item(index)!;
      attributes[attribute.name] = attribute.value;
    }
    return attributes;
  }

  private appendShape(xml: Document, parent: Element, shape: Shape, depth: number): void {
    parent.appendChild(xml.createTextNode(`\n${'  '.repeat(depth)}`));
    const element = xml.createElementNS(this.namespace, shape.tag);
    for (const [name, value] of Object.entries(shape.attributes())) element.setAttribute(name, value);
    if (!element.hasAttribute('id')) element.setAttribute('id', shape.id);
    if (shape.text !== undefined) element.appendChild(xml.createTextNode(shape.text));
    for (const child of shape.children) this.appendShape(xml, element, child, depth + 1);
    if (shape.children.length > 0) element.appendChild(xml.createTextNode(`\n${'  '.repeat(depth)}`));
    parent.appendChild(element);
  }
}
