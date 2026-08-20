const require = process.mainModule.require.bind(process.mainModule);

var input = require('fs').readFileSync('/dev/stdin', 'utf8');
var values = input.trim().split('\n').map(Number);
var inputSize = values.shift();
var previous = values.shift();
var runLength = 1;
var maximumRunLength = 1;
var previousDirection = 0;

values.forEach(value => {
  if (previous > value) {
    if (previousDirection === 1) {
      runLength = 2;
    } else {
      runLength++;
    }
    previousDirection = -1;
  } else if (previous < value) {
    if (previousDirection === -1) {
      runLength = 2;
    } else {
      runLength++;
    }
    previousDirection = 1;
  }

  maximumRunLength = Math.max(maximumRunLength, runLength);
  previous = value;
});

console.log(maximumRunLength);
