const fs = require("fs");

const input = fs.readFileSync("/dev/stdin", "utf8").trim();
const text = input.split("\n")[0].split(" ").reverse().pop();
const length = text.length;

let palindromeLength = (length + 1) >> 1;
let left;
let right = palindromeLength;
const centerCharacter = text[palindromeLength - 1];

if (length & 1) {
  left = palindromeLength - 2;
} else {
  left = palindromeLength - 1;
}

for (; left >= 0; left--, right++) {
  if (text[left] !== centerCharacter || text[right] !== centerCharacter) {
    break;
  }
  palindromeLength++;
}

console.log(palindromeLength);
