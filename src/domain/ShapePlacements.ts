import type { Shape } from './Shape.js';

/** 只保留移动节点的引用、旧父节点和旧下标，不复制兄弟节点或子树。 */
export class ShapePlacements {
  private readonly entries;

  constructor(shapes: readonly Shape[]) {
    this.entries = shapes.map(shape => ({
      shape,
      parent: shape.parent!,
      index: shape.parent!.children.indexOf(shape),
    }));
  }

  restore(): void {
    for (const { shape } of this.entries) shape.parent?.remove(shape);
    // 同一父节点按旧下标升序插入，恢复不连续选择的原有顺序。
    for (const { shape, parent, index } of [...this.entries].sort((a, b) => a.index - b.index)) {
      parent.insert(shape, index);
    }
  }
}
