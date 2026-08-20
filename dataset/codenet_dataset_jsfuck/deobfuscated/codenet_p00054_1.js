const require = process.mainModule.require.bind(process.mainModule);
var input = require("fs").readFileSync("/dev/stdin", "utf8");
var lines = input.trim().split("\n");

for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
  var values = lines[lineIndex].split(" ").map(Number);
  var decimalPlaces = values[2];
  var digitSum = 0;

  while (decimalPlaces--) {
    var decimalText = (values[0] / values[1])
      .toFixed(decimalPlaces + 2)
      .slice(-2);
    digitSum += decimalText[0] - 0;
  }

  console.log(digitSum);
}
