const padLeft = (value, length, character) =>
  ([...Array(length)].map((unused) => character).join('') + value).slice(length * -1);

const splitIntoChunks = (value, chunkSize) =>
  ((characters) =>
    characters.reduce(
      (chunks, _, index) =>
        index % chunkSize
          ? chunks
          : [...chunks, characters.slice(index, index + chunkSize).join('')],
      []
    ))([...value]);

const arrangeNumber = (number) =>
  ((parts) =>
    parts[0] ? [parts[0] - 1, parts[1] + 10000000000] : parts)(
    splitIntoChunks(padLeft(number, 20, '0'), 10).map((part) => +part)
  );

const countMultiplesInRange = (start, end, divisor) =>
  Math.floor(end / divisor) - Math.floor(start / divisor);

const countMultiplesInInclusiveRange = (start, end, divisor) =>
  Math.floor(end / divisor) -
  (start == 0 ? -1 : Math.floor((start - 1) / divisor));

const numberOrEmptyString = (number) => (number ? String(number) : '');

const solveArrangedRange = (startParts, endParts, divisor) =>
  `${numberOrEmptyString(
    countMultiplesInRange(+startParts[0], endParts[0], divisor)
  )}${countMultiplesInInclusiveRange(startParts[1], endParts[1], divisor)}`;

const solveRange = (start, end, divisor) =>
  solveArrangedRange(arrangeNumber(start), arrangeNumber(end), divisor);

const solveInput = (input) => solveRange(...input.split(' '));

console.log(solveInput(require('fs').readFileSync('/dev/stdin', 'utf8')));
