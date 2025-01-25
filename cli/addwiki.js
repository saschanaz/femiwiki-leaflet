import { WikiRestClient } from "./lib/wikiapi.js";

async function getConfig() {
  try {
    return (await import("./config.json", { with: { type: "json" } })).default;
  } catch {
    return {
      access_token: Deno.env.get("FEMIWIKI_ACCESS_TOKEN"),
    };
  }
}

/**
 * @param {string} name
 */
function hasTerminalConsonant(name) {
  const lastChar = name.codePointAt(name.length - 1);
  return (lastChar - 0xac00) % 28;
}

/**
 * @param {string} name
 */
function unnun(name) {
  return hasTerminalConsonant(name) ? "은" : "는";
}

const config = await getConfig();
const client = new WikiRestClient(
  "https://femiwiki.com/rest.php/",
  config.access_token
);

const file = await Deno.readTextFile(new URL("../sheet.tsv", import.meta.url));
const lines = file.split("\n");
lines.shift();
const map = new Map();
for (const line of lines) {
  const [
    _wikiUrl,
    name,
    fullName,
    region,
    tags,
    school,
    website,
    instagram,
    facebook,
    linktree,
    twitter,
    coalition,
  ] = line.split("\t");
  map.set(name, {
    name,
    fullName,
    region,
    tags,
    school,
    website,
    instagram,
    facebook,
    linktree,
    twitter,
    coalition,
  });
}

const skipped = [];
const errored = [];
const nameWikiMap = new Map();

for (const [name, object] of map) {
  const docName = (() => {
    const docName = object.fullName || object.name;
    return docName
      .replace("/", "")
      .replace("#", "")
      .replace("<", "'")
      .replace(">", "'");
  })();

  const existing = await client.tryGet(docName);
  if (existing.ok) {
    nameWikiMap.set(name, existing.data.id);
    console.log(`${name}: https://femiwiki.com/?curid=${existing.data.id}`);
    continue;
  }

  if (
    !object.website &&
    !object.instagram &&
    !object.facebook &&
    !object.linktree &&
    !object.twitter &&
    !object.coalition
  ) {
    skipped.push(name);
    console.log(`${name}:`);
    continue;
  }

  console.log(`${docName} is missing a document, creating...`);
  try {
    const tags = object.tags?.split(",").map(tag => tag.trim());
    const linkedTags = tags?.map((tag) => `[[${tag}]]`).join(", ");
    const linkedTagsWithSpace = linkedTags ? `${linkedTags} ` : "";
    const ofRegion = object.school || object.region;
    const ofRegionFormatted = ofRegion ? `[[${ofRegion}]]` : "대한민국";

    let source = `'''${name}'''${unnun(
      docName
    )} ${ofRegionFormatted}의 ${linkedTagsWithSpace}단체이다.\n\n{{공식 링크}}`;

    if (object.tags.includes("페미니즘")) {
      source += `\n[[분류:성격/페미니즘 단체]]`;
    }
    if (object.tags.includes("퀴어")) {
      source += `\n[[분류:성격/성소수자 단체]]`;
    }

    const data = await client.edit(docName, {
      source,
      comment:
        "[[페미위키:단체 활동 기록 프로젝트]]의 일환으로 일괄 생성한 문서입니다.",
    });
    nameWikiMap.set(name, data.id);
  } catch (err) {
    errored.push(name);
    console.error(err);
    continue;
  }
}

console.log(nameWikiMap);
console.log(`Skipped: ${skipped}`);
console.log(`Errored: ${errored}`);
