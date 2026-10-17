import type { Shape } from '../domain/Shape.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

/** 通过统一的 Shape 接口渲染，不按图形类型分派。 */
export class TreeView {
  tree(document: SvgDocument, id?: string): string {
    const lines: string[] = [];
    if (id !== undefined) {
      const shape = document.find(id);
      lines.push(shape.summary());
      this.children(shape, '', lines);
    } else {
      lines.push(`svg (${document.width}x${document.height})`);
      this.children(document.root, '', lines);
    }
    return lines.join('\n');
  }

  show(document: SvgDocument, id: string): string {
    const shape = document.find(id);
    const parent = shape.parent === document.root ? 'svg' : `g#${shape.parent?.id}`;
    const lines = [`${shape.tag}#${shape.id}  parent=${parent}`];
    const attributes = Object.entries(shape.attributes()).filter(([name]) => name !== 'id');
    if (attributes.length) lines.push(`  ${attributes.map(([name, value]) => `${name}=${value}`).join(' ')}`);
    if (shape.text !== undefined) lines.push(`  text=${JSON.stringify(shape.text)}`);
    return lines.join('\n');
  }

  private children(parent: Shape, prefix: string, lines: string[]): void {
    parent.children.forEach((child, index) => {
      const last = index === parent.children.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${child.summary()}`);
      this.children(child, `${prefix}${last ? '    ' : '│   '}`, lines);
    });
  }
}
