import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const sourceFiles = project.getSourceFiles();
let updatedCount = 0;

for (const sourceFile of sourceFiles) {
  let fileUpdated = false;

  // Find imports from '@/lib/supabase/server'
  const imports = sourceFile.getImportDeclarations();
  const serverImport = imports.find(i => {
    const specifier = i.getModuleSpecifierValue();
    return specifier === '@/lib/supabase/server' || specifier === '../lib/supabase/server' || specifier.includes('lib/supabase/server');
  });

  if (!serverImport) continue;

  // Check if createClient is imported
  const namedImports = serverImport.getNamedImports();
  const hasCreateClient = namedImports.some(n => n.getName() === 'createClient');
  if (!hasCreateClient) continue;

  // Find all call expressions to createClient
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const callExpr of callExpressions) {
    const expr = callExpr.getExpression();
    if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'createClient') {
      
      // Check if it's already awaited
      const parent = callExpr.getParent();
      if (parent && parent.getKind() === SyntaxKind.AwaitExpression) {
        continue; // Already awaited
      }

      // Now we need to ensure the enclosing function is async
      let current = callExpr.getParent();

      // We need to replace `createClient()` with `await createClient()`
      callExpr.replaceWithText(`await ${callExpr.getText()}`);
      fileUpdated = true;
      while (current) {
        if (
          current.getKind() === SyntaxKind.FunctionDeclaration ||
          current.getKind() === SyntaxKind.ArrowFunction ||
          current.getKind() === SyntaxKind.FunctionExpression ||
          current.getKind() === SyntaxKind.MethodDeclaration
        ) {
          const modifiers = current.getModifiers();
          const isAsync = modifiers.some(m => m.getKind() === SyntaxKind.AsyncKeyword);
          if (!isAsync) {
            // @ts-ignore
            if (current.setIsAsync) {
                // @ts-ignore
                current.setIsAsync(true);
            } else if (current.getKind() === SyntaxKind.ArrowFunction) {
                // ts-morph ArrowFunction has setIsAsync
                // @ts-ignore
                current.setIsAsync(true);
            }
          }
          break; // Stop at the nearest function
        }
        current = current.getParent();
      }
    }
  }

  if (fileUpdated) {
    sourceFile.saveSync();
    updatedCount++;
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}

console.log(`Refactored ${updatedCount} files.`);
