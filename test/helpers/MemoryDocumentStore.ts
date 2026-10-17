import type { DocumentStore } from '../../src/application/DocumentStore.js';
import type { SvgDocument } from '../../src/domain/SvgDocument.js';

/** 内存文件端口替身，测试不依赖磁盘，也能模拟写入失败。 */
export class MemoryDocumentStore implements DocumentStore {
  private readonly files = new Map<string, { document: SvgDocument; warnings: string[] }>();
  private writesFail = false;

  seed(path: string, document: SvgDocument, warnings: string[] = []): void {
    this.files.set(path, { document: document.clone(), warnings: [...warnings] });
  }

  rejectWrites(reject: boolean): void {
    this.writesFail = reject;
  }

  async read(path: string): Promise<{ document: SvgDocument; warnings: string[] }> {
    const file = this.files.get(path);
    if (!file) throw new Error(`cannot read file: ${path}`);
    return { document: file.document.clone(), warnings: [...file.warnings] };
  }

  async write(path: string, document: SvgDocument): Promise<void> {
    if (this.writesFail) throw new Error(`cannot write file: ${path}`);
    this.seed(path, document);
  }
}
