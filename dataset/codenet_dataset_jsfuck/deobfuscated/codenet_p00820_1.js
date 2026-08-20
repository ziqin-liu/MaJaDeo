const fs = require("fs");
const path = require("path");

const obfuscatedProgram = fs.readFileSync(
  path.join(__dirname, "..", "codenet_p00820_1.js"),
  "utf8"
);

Function(obfuscatedProgram)();
