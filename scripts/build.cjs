// Publish only the browser assets. No dependencies or bundler required.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "calculator.js",
  "brokers.js",
  "app.js",
  "assets/favicon.svg",
];
for (const file of files) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
console.log(`Built ${files.length} browser assets in dist/`);
