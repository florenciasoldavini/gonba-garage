import { readFileSync } from 'node:fs';
import ts from 'typescript';

// The modules a source file loads at run time. Type-only imports are erased, as in the build.
export function runtimeImports(path) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return ts.preProcessFile(outputText, true, true).importedFiles.map(({ fileName }) => fileName);
}
