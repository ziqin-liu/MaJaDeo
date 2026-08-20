(() => {
  "use strict";

  const require = process.mainModule.require.bind(process.mainModule);

  const createInputReader = () => {
    const input = require("fs")
      .readFileSync("/dev/stdin", "utf8")
      .trim()
      .split("\n");

    const reader = {
      list: input,
      index: 0,
      max: input.length,
      hasNext: function () {
        return this.index < this.max;
      },
      next: function () {
        if (!this.hasNext()) {
          throw "ArrayIndextuttfBoundsException";
        }

        return this.list[this.index++];
      },
    };

    return reader;
  };

  const inputReader = createInputReader();
  const next = () => inputReader.next();
  const nextInt = () => parseInt(next());
  const nextStringArray = () => next().split(" ");
  const nextIntArray = () => next().split(" ").map((element) => parseInt(element));
  const nextCharArray = () => next().split("");
  const hasNext = () => inputReader.hasNext();
  const output = (...values) => console.log(...values);

  const main = () => {
    const [n, m] = nextIntArray();
    let answer = m <= 2 * n ? Math.floor(M / 2) : Math.floor((2 * n + m) / 4);
    console.log(answer);
  };

  main();
})();
