import type { SvgDocument } from '../domain/SvgDocument.js';

/** 文件访问端口：应用层不关心 SVG 解析和磁盘读写。 */
export interface DocumentStore {
  read(path: string): Promise<{ document: SvgDocument; warnings: string[] }>;
  write(path: string, document: SvgDocument): Promise<void>;
}
