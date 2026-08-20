const fs = require("fs");

const [minimum, maximum, count] = fs
  .readFileSync(0, "utf8")
  .trim()
  .split(/\s+/)
  .map(Number);

for (let value = minimum; value <= maximum; value += 1) {
  if (value - minimum < count || maximum - value < count) {
    console.log(value);
  }
}
