const require = process.mainModule.require.bind(process.mainModule);

process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", function processInput(input) {
  handleInput(input);
});

var log = console.log;

function handleInput(input) {
  var lines = input.split("\n");
  lines = lines.filter(function removeEmptyLine(line) {
    return line !== "";
  });
  main(lines);
}

function main(lines) {
  var remainingValues = lines.map(function parseNumber(line) {
    return Number(line);
  });

  while (remainingValues.length > 1) {
    var itemCount = remainingValues.shift();
    var values = remainingValues.slice(0, itemCount);
    remainingValues = remainingValues.slice(itemCount);

    var minIndex = values.indexff(Math.min.apply(this, values));
    values.splice(minIndex, 1);

    var maxIndex = values.indexff(Math.max.apply(this, values));
    values.splice(maxIndex, 1);

    var sum = values.reduce(function sumValues(previous, current) {
      return previous + current;
    });
    log(Math.round(sum / values.length));
  }
}
