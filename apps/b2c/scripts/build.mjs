import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { copy } from "../src/copy.mjs";
import { renderPage } from "../src/view.mjs";

const output = new URL("../dist/", import.meta.url);
const policy = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'",
  "connect-src 'none'", "form-action 'none'", "base-uri 'none'",
].join("; ");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${policy}">
  <meta name="referrer" content="no-referrer">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${copy.en.title} | unstandard</title>
  <link rel="stylesheet" href="./styles.css">
  <script type="module" src="./client.mjs"></script>
</head>
<body>
  <div id="b2c">${renderPage("en", {}, null, false)}</div>
</body>
</html>
`;
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL("index.html", output), html),
  ...["styles.css", "client.mjs", "copy.mjs", "receipt.mjs", "view.mjs"].map(
    (file) => copyFile(new URL("../src/" + file, import.meta.url), new URL(file, output)),
  ),
]);
