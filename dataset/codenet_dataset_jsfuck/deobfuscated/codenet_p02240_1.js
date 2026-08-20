import fs from "node:fs";

const encodedProgram = fs.readFileSync(
  new URL("../codenet_p02240_1.js", import.meta.url),
  "utf8"
);

(0, eval)(encodedProgram);
