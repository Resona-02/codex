import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';

test('source classes use matching files, polymorphism and no free-function business entry points', () => {
  const files = readdirSync('src', { recursive: true }).map(String).filter(file => file.endsWith('.ts'));
  for (const file of files) {
    const source = readFileSync(join('src', file), 'utf8');
    const classes = [...source.matchAll(/^export (?:abstract )?class (\w+)/gm)];
    assert.ok(classes.length <= 1, `${file}: one class per file`);
    for (const declaration of classes) {
      assert.equal(declaration[1], basename(file, '.ts'), `${file}: filename must match class`);
    }
    assert.doesNotMatch(source, /^(?:export )?(?:async )?function\s/m, `${file}: core behavior belongs in classes`);
    // SVG 类型与命令名字统一使用两个注册表，禁止新增散落的 switch 分派。
    assert.doesNotMatch(source, /\bswitch\s*\(/, `${file}: use polymorphism instead of switch dispatch`);
  }
});

test('imports follow the documented dependency directions', () => {
  const allowed: Readonly<Record<string, readonly string[]>> = {
    domain: ['domain'],
    application: ['application', 'domain'],
    infrastructure: ['infrastructure', 'application', 'domain'],
    cli: ['cli', 'application'],
  };
  const files = readdirSync('src', { recursive: true }).map(String).filter(file => file.endsWith('.ts'));
  for (const file of files) {
    const layer = file.split('/')[0];
    if (!allowed[layer]) continue; // main.ts 作为依赖注入的组装入口。
    const fullPath = resolve('src', file);
    const source = readFileSync(fullPath, 'utf8');
    for (const declaration of source.matchAll(/^import .+ from ['"](.+)['"];?$/gm)) {
      const specifier = declaration[1];
      if (specifier.startsWith('.')) {
        const target = relative(resolve('src'), resolve(dirname(fullPath), specifier)).split('/')[0];
        assert.ok(allowed[layer].includes(target), `${file} must not depend on ${target}`);
      } else if (layer === 'domain' || layer === 'application') {
        assert.fail(`${file} must not import external/IO module ${specifier}`);
      }
    }
  }
});

test('command execute and undo methods only forward to their receiver', () => {
  const files = readdirSync('src/application').filter(file => file.endsWith('Command.ts') && file !== 'Command.ts');
  for (const file of files) {
    const source = readFileSync(join('src/application', file), 'utf8');
    const methods = [...source.matchAll(/^\s+(?:override )?(?:execute|undo)\(\): [^{]+\{([^}]+)\}/gm)];
    assert.ok(methods.length > 0, `${file}: must expose a forwarding method`);
    for (const [, body] of methods) {
      assert.match(body.trim(), /^return this\.receiver\.\w+\([^;]*\);$/, `${file}: delegate only`);
    }
    assert.doesNotMatch(source, /\b(?:if|for|while|switch|try)\s*[({]|\.(?:clone|find|setAttribute)\(/,
      `${file}: business rules and state restoration belong to receivers`);
  }
});
