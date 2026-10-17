import type { Token } from './Token.js';

/** 只处理词法，不执行命令；# 仅在整行开头表示注释。 */
export class Tokenizer {
  tokenize(line: string): readonly Token[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: Token[] = [];
    let value = '';
    let inQuotes = false;
    let quoted = false;
    let started = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"') {
        inQuotes = !inQuotes;
        quoted = true;
        started = true;
      } else if (inQuotes && character === '\\' && ['"', '\\'].includes(line[index + 1])) {
        value += line[++index];
      } else if (!inQuotes && /\s/.test(character)) {
        if (started) tokens.push({ value, quoted });
        value = '';
        quoted = false;
        started = false;
      } else {
        value += character;
        started = true;
      }
    }
    if (inQuotes) throw new Error('unterminated double quote');
    if (started) tokens.push({ value, quoted });
    return tokens;
  }
}
