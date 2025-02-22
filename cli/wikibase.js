import { MediaWikiClient } from "./lib/wikiapi.js";

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
 * @param {string} datatype
 * @param {object} value
 * @param {string} valuetype
 */
function createWikibaseProperty(name, datatype, value, valuetype) {
  return {
    mainsnak: {
      snaktype: "value",
      property: name,
      datavalue: { value, type: valuetype },
      datatype,
    },
    type: "statement",
    rank: "normal",
  };
}

/**
 * @param {string} name
 * @param {string} value
 */
function createWikibaseStringProperty(name, value) {
  return createWikibaseProperty(name, "string", value, "string");
}

function getFirstDirName(url) {
  return new URL(url).pathname.slice(1).replace(/\/$/, "");
}

/**
 * @param {string} docName
 * @param {*} entry
 */
function createWikibaseData(docName, entry) {
  const claims = [];
  if (entry.website) {
    claims.push(createWikibaseStringProperty("P16", entry.website));
  }
  if (entry.instagram) {
    claims.push(createWikibaseStringProperty("P53", getFirstDirName(entry.instagram)));
  }
  if (entry.facebook) {
    const url = new URL(entry.facebook);
    const value = url.searchParams.get("id") ?? getFirstDirName(url)
    claims.push(createWikibaseStringProperty("P52", value));
  }
  if (entry.linktree) {
    claims.push(createWikibaseStringProperty("P88", getFirstDirName(entry.linktree)));
  }
  if (entry.twitter) {
    claims.push(createWikibaseStringProperty("P51", getFirstDirName(entry.twitter)));
  }
  return {
    claims,
    sitelinks: {
      femiwiki: {
        site: "femiwiki",
        title: docName,
        badges: [],
      },
    },
    labels: {
      ko: {
        language: "ko",
        value: docName,
      },
    },
  };
}

const config = await getConfig();
const actionClient = new MediaWikiClient(
  "https://femiwiki.com/w/api.php",
  config.access_token
);

const file = await Deno.readTextFile(new URL("../sheet.tsv", import.meta.url));
const lines = file.split("\n");
lines.shift();
const map = new Map();
for (const line of lines) {
  const [
    wikiUrl,
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
    currentActivity,
    ceased,
  ] = line.split("\t");
  map.set(name, {
    wikiUrl,
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
    currentActivity,
    ceased,
  });
}

const skipped = [];

const {
  query: {
    tokens: { csrftoken },
  },
} = await actionClient.tryRequestAction("query", {
  meta: "tokens",
});

for (const [name, object] of map) {
  if (!object.wikiUrl) {
    skipped.push(name);
    console.warn(`${name} has no wiki url`);
    continue;
  }

  if (
    !object.website &&
    !object.instagram &&
    !object.facebook &&
    !object.linktree &&
    !object.twitter
  ) {
    skipped.push(name);
    console.log(`${name} has no online contact`);
    continue;
  }

  const curid = new URL(object.wikiUrl).searchParams.get("curid");
  const { query: { pages } } = await actionClient.tryRequestAction("query", { pageids: curid });
  const docName = pages[curid].title;

  const { entities } = await actionClient.tryRequestAction("wbgetentities", {
    sites: "femiwiki",
    titles: docName,
  });

  const entries = Object.entries(entities);

  if (entries[0][0] !== "-1") {
    skipped.push(name);
    console.log(`${name}: ${entries[0][0]}`);
    continue;
  }

  console.log(`${name} is missing a wikibase entity, creating...`);

  const result = await actionClient.tryRequestAction("wbeditentity", {
    new: "item",
    data: JSON.stringify(createWikibaseData(docName, object)),
    token: csrftoken,
  });
  if (!result.entity) {
    throw new Error("No entity?", { cause: result });
  }
  console.log(`${name}: ${result.entity.id}`);
}

console.log(`Skipped: ${skipped}`);
