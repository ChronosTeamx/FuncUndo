import * as vscode from 'vscode';
import Parser from 'web-tree-sitter';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('Chronos activated!');

  try {
    // Correct runtime wasm path
    const runtimeWasmPath = path.join(context.extensionPath, 'dist', 'wasm', 'tree-sitter.wasm');

    console.log('Runtime wasm:', runtimeWasmPath);

    // Initialize runtime
    await Parser.init({
      locateFile() {
        return runtimeWasmPath;
      },
    });

    // Create parser
    const parser = new Parser();

    // JS grammar path
    const grammarWasmPath = path.join(
      context.extensionPath,
      'dist',
      'wasm',
      'tree-sitter-javascript.wasm',
    );

    console.log('Grammar wasm:', grammarWasmPath);

    // Load JS grammar
    const JavaScript = await Parser.Language.load(grammarWasmPath);

    parser.setLanguage(JavaScript);

    console.log('SUCCESS: WebAssembly Parser is armed and ready.');

    vscode.window.showInformationMessage('WASM Parser initialized successfully!');
  } catch (error) {
    console.error(error);

    vscode.window.showErrorMessage(`WASM Parser failed: ${String(error)}`);
  }
}

export function deactivate() {}
