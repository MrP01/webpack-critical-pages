const penthouse = require("penthouse");
const path = require("path");
const fs = require("fs");
const bent = require("bent");
const crypto = require("crypto");

const requestBuffer = bent("buffer");

export function getCriticalPages(base, apps) {
  const pages = [];
  const rootEntries = require(path.join(base, "entrypoints.json"));
  for (const entryName of Object.keys(rootEntries)) {
    pages.push({
      entrypoint: entryName,
      exampleUrl: rootEntries[entryName].exampleUrl,
    });
  }
  for (const app of apps) {
    const appEntries = require(path.join(base, app, "entrypoints.json"));
    for (const entryName of Object.keys(appEntries)) {
      pages.push({
        entrypoint: app + "/" + entryName,
        exampleUrl: appEntries[entryName].exampleUrl,
      });
    }
  }
  return pages;
}

export async function extractCriticalCSS(
  criticalPages,
  source,
  destination,
  webpackStats,
  language = "en",
  devServerUrl = "http://localhost:8000",
  penthouseOptions = {}
) {
  function getEntryPointCSS(entrypoint) {
    let cssString = "";
    const grps = webpackStats.chunks[entrypoint];
    for (const file of grps) {
      if (/\.css$/.test(file)) {
        cssString += fs.readFileSync(path.join(source, language, webpackStats.assets[file].path));
      }
    }
    return cssString;
  }

  function startNewJob() {
    const page = criticalPages.pop();
    if (!page) {
      return Promise.resolve();
    } else if (page.exampleUrl == null) {
      return startNewJob();
    }
    console.log(`extracting page ${page.exampleUrl}...`);
    return penthouse({
      url: `${devServerUrl}/${language}${page.exampleUrl}`,
      cssString: getEntryPointCSS(page.entrypoint),
      ...penthouseOptions,
    })
      .then((criticalCss) => {
        let target = path.join(destination, page.entrypoint + ".critical.css");
        let dirname = path.dirname(target);
        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
        fs.writeFileSync(target, criticalCss);
        return startNewJob();
      })
      .catch((error) => {
        console.log("Page fetch was unsuccessful! Error:", error);
        process.exit(1);
      });
  }

  try {
    await Promise.all([startNewJob(), startNewJob(), startNewJob(), startNewJob()]);
    console.log("all done!");
  } catch (reason) {
    console.error("Error occured", reason);
  }
}

export function loadEntrypoints(base, rootEntryPoints, apps) {
  for (let app of apps) {
    if (app === null) app = "";
    let appEntries = require(path.join(base, app, "entrypoints.json"));
    for (let entryName of Object.keys(appEntries)) {
      let normalized = (app + "/" + entryName).replace(/^\/|\/$/g, "");
      rootEntryPoints[normalized] = "./" + path.join(app, appEntries[entryName].file);
    }
  }
  return rootEntryPoints;
}

export async function fetchPageEntries(pagesToPrecache, devServerUrl = "http://localhost:8000") {
  let extraManifestEntries = [];
  try {
    console.log("calculating page hashes from local dev server...");
    for (let i = 0; i < pagesToPrecache.length; i++) {
      let pagePath = pagesToPrecache[i];
      let fullUrl = devServerUrl + pagePath;
      let response = await requestBuffer(fullUrl);
      let md5 = crypto.createHash("md5");
      md5.update(response);
      extraManifestEntries.push({
        url: pagePath,
        revision: md5.digest("hex"),
      });
    }
    console.log(extraManifestEntries);
  } catch (e) {
    console.warn("Could not fetch entries, skipping.", e);
  }
  return extraManifestEntries;
}
