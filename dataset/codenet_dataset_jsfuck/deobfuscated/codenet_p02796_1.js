"use strict";

const fs = require("fs");
const lines = fs.readFileSync("/dev/stdin", "utf8").trim().split("\n");

lines.shift();

const intervals = lines
  .map((line) => {
    const [center, radius] = line.split(" ").map(Number);
    return [center - radius, center + radius];
  })
  .sort((left, right) => left[1] - right[1]);

let count = 0;
let lastEnd = Number.MIN_SAFE_INTEGER;

for (let index = 0; index < intervals.length; index++) {
  if (lastEnd <= intervals[index][0]) {
    count++;
    lastEnd = intervals[index][1];
  }
}

console.log(count);
