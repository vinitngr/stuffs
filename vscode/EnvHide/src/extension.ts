import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const decoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "#000000",
    color: "#000000",
    borderRadius: "2px"
  });

  const applyMask = (editor?: vscode.TextEditor) => {
    if (!editor) return;
    if (!editor.document.fileName.endsWith(".env")) return;

    const decorations: vscode.DecorationOptions[] = [];
    const text = editor.document.getText();
    const lines = text.split("\n");

    lines.forEach((line, i) => {
      if (!line.includes("=") || line.trim().startsWith("#")) return;

      const eq = line.indexOf("=");
      const valueStart = eq + 1;

      if (valueStart >= line.length) return;

      const range = new vscode.Range(
        new vscode.Position(i, valueStart),
        new vscode.Position(i, line.length)
      );

      decorations.push({ range });
    });

    editor.setDecorations(decoration, decorations);
  };

  if (vscode.window.activeTextEditor) {
    applyMask(vscode.window.activeTextEditor);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(applyMask),
    vscode.workspace.onDidChangeTextDocument(() => {
      applyMask(vscode.window.activeTextEditor);
    })
  );
}

export function deactivate() {}
