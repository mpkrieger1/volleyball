import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('root tooling', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

  it('pins Node >= 20', () => {
    expect(pkg.engines?.node).toMatch(/>=\s*20/);
  });

  it('declares the four workspaces', () => {
    expect(pkg.workspaces).toEqual(expect.arrayContaining(['shared', 'main', 'workers', 'app']));
  });

  it.each([
    'dev',
    'build',
    'test',
    'test:e2e',
    'lint',
    'typecheck',
    'format',
  ])('has script "%s"', (name) => {
    expect(pkg.scripts?.[name]).toBeTypeOf('string');
  });
});
