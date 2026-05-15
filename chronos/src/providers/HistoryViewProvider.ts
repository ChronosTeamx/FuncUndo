import * as vscode from 'vscode';

export class HistoryViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'),
    );

    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css'),
    );

    webviewView.webview.html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />

    <meta
        http-equiv="Content-Security-Policy"
        content="
            default-src 'none';
            style-src ${webviewView.webview.cspSource} 'unsafe-inline';
            script-src ${webviewView.webview.cspSource};
        "
    />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />

    <link
      href="${styleUri}"
      rel="stylesheet"
    />
</head>

<body>
    <div id="root"></div>

    <script src="${scriptUri}"></script>
</body>
</html>
`;
  }
}

// function getNonce() {
//     let text = '';
//     const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//     for (let i = 0; i < 32; i++) {
//         text += possible.charAt(Math.floor(Math.random() * possible.length));
//     }
//     return text;
// }
