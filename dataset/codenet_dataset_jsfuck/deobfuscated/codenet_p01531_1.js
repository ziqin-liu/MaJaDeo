const requireFromMain = process.mainModule.require.bind(process.mainModule);
const input = requireFromMain("fs").readFileSync("/dev/stdin", "utf8");
const characters = input.trim().split("");
let decoded = "";

characters.forEach(function decodeCharacter(character) {
  if (character === "0") decoded += "w";
  if (character === "1") decoded += "";
  if (character === "2") decoded += "k";
  if (character === "3") decoded += "s";
  if (character === "4") decoded += "t";
  if (character === "5") decoded += "n";
  if (character === "6") decoded += "h";
  if (character === "7") decoded += "m";
  if (character === "8") decoded += "y";
  if (character === "9") decoded += "r";
  if (character === "T") decoded += "a";
  if (character === "L") decoded += "i";
  if (character === "U") decoded += "u";
  if (character === "R") decoded += "e";
  if (character === "D") decoded += "o";
});

decoded = decoded.replace(/wu/g, "nn");
console.log(decoded);
