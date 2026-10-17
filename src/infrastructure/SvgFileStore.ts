import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { DocumentStore } from '../application/DocumentStore.js';
import { SvgDocument } from '../domain/SvgDocument.js';
import { SvgCodec } from './SvgCodec.js';

/** File-system adapter; writes are replaced atomically only after serialization succeeds. */
export class SvgFileStore implements DocumentStore {
  constructor(private readonly codec = new SvgCodec()) {}

  async read(path: string): Promise<{ document: SvgDocument; warnings: string[] }> {
    let xml: string;
    try {
      xml = await readFile(path, 'utf8');
    } catch {
      throw new Error(`cannot read file: ${path}`);
    }
    return this.codec.decode(xml);
  }

  async write(path: string, document: SvgDocument): Promise<void> {
    const xml = this.codec.encode(document);
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, xml, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
    } catch {
      await unlink(temporary).catch(() => undefined);
      throw new Error(`cannot write file: ${path}`);
    }
  }
}
