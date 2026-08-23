const require = process.mainModule.require.bind(process.mainModule);
var input = require("fs").readFileSync("/dev/stdin", "utf8");
var lines = input.trim().split("\n");

while (true) {
  var binaryString = lines.shift();
  if (binaryString === undefined) break;

  var state = "A";

  for (var index = 0; index < binaryString.length; index++) {
    var bit = binaryString[index] - 0;

    if (state === "A" && bit === 0) state = "X";
    else if (state === "A" && bit === 1) state = "Y";
    else if (state === "B" && bit === 0) state = "Y";
    else if (state === "B" && bit === 1) state = "X";
    else if (state === "X" && bit === 0) state = "B";
    else if (state === "X" && bit === 1) state = "Y";
    else if (state === "Y" && bit === 0) state = "A";
    else if (state === "Y" && bit === 1) state = "Z";
    else if (state === "Z" && bit === 0) state = "X";
    else if (state === "Z" && bit === 1) state = "B";
  }

  console.log(state === "B" ? "Yes" : "No");
}
