const file = await Deno.readTextFile(new URL("../sheet.tsv", import.meta.url));
const lines = file.split("\n");
lines.shift();
const countMap = new Map();
for (const line of lines) {
  const name = line.split("\t")[0];
  let count = countMap.get(name) ?? 0;
  ++count;
  countMap.set(name, count);
}

for (const [name, count] of countMap) {
  if (count > 1) {
    console.warn(`${name} is duplicated`);
  }
}
