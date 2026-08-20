const require = process.mainModule.require.bind(process.mainModule);

function main(input) {
  const values = new Set(input.split("\n").join(" ").split(" "));
  const answer = [...values].length === 4 ? "Four" : "Three";
  console.log(answer);
}

main(require("fs").readFileSync("/dev/stdin", "utf8"));
