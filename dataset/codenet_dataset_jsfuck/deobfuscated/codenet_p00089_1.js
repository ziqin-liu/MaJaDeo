function explorePath(row, column, sum) {
  bestSums[row][column] = sum;

  if (row == rows.length - 1) {
    maximumSum = Math.max(maximumSum, sum);
  } else if ((rows.length - 1) / 2 > row) {
    if (bestSums[row + 1][column] < sum + rows[row + 1][column]) {
      explorePath(row + 1, column, sum + rows[row + 1][column]);
    }
    if (bestSums[row + 1][column + 1] < sum + rows[row + 1][column + 1]) {
      explorePath(row + 1, column + 1, sum + rows[row + 1][column + 1]);
    }
  } else if ((rows.length - 1) / 2 <= row) {
    if (column - 1 >= 0) {
      if (bestSums[row + 1][column - 1] < sum + rows[row + 1][column - 1]) {
        explorePath(row + 1, column - 1, sum + rows[row + 1][column - 1]);
      }
    }
    if (column < rows[row].length - 1) {
      if (bestSums[row + 1][column] < sum + rows[row + 1][column]) {
        explorePath(row + 1, column, sum + rows[row + 1][column]);
      }
    }
  }
}

var input = require('fs').readFileSync('/dev/stdin', 'utf8');
var inputLines = input.trim().split('\n');
var rows = [];
var bestSums = [];

inputLines.forEach(function (line) {
  var values = line.split(',').map(Number);
  var initialBestSums = values.map(function () {
    return 0;
  });

  rows.push(values);
  bestSums.push(initialBestSums);
});

var maximumSum = 0;
explorePath(0, 0, rows[0][0]);
console.log(maximumSum);
