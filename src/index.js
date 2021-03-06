const penthouse = require("penthouse");
const path = require("path");
const fs = require("fs");
const bent = require("bent");
const crypto = require("crypto");

const requestBuffer = bent("buffer");

export function extractCriticalCSS(base, apps, criticalPages, source, destination, webpackStats, language = "en", devServerUrl = "http://localhost:8000") {
  for (const app of apps) {
    const appEntries = require(path.join(base, app, "entrypoints.json"));
    for (const entryName of Object.keys(appEntries)) {
      criticalPages.push({
        "entrypoint": app + "/" + entryName,
        "exampleUrl": appEntries[entryName].exampleUrl
      });
    }
  }
  const penthouseOptions = {};

  function getEntryPointCSS(entrypoint) {
    let cssString = "";
    const grps = webpackStats.entryPoints[entrypoint];
    for (const grp of grps) {
      for (const file of grp) {
        if (/\.css$/.test(file.name)) {
          cssString += fs.readFileSync(path.join(source, file.path));
        }
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
    const totalEntrypoints = page.hasOwnProperty("totalEntrypoints") ? page.totalEntrypoints : ["main"];
    return penthouse({
      url: `${devServerUrl}/${language}${page.exampleUrl}`,
      cssString: totalEntrypoints.map(getEntryPointCSS).join(""),
      ...penthouseOptions
    }).then(criticalCss => {
      let target = path.join(destination, page.entrypoint + ".critical.css");
      let dirname = path.dirname(target);
      if (!fs.existsSync(dirname))
        fs.mkdirSync(dirname, {recursive: true});
      fs.writeFileSync(target, criticalCss);
      return startNewJob();
    }).catch(error => {
      console.log("Page fetch was unsuccessful! Error:", error);
      process.exit(1);
    });
  }

  return Promise.all([
    startNewJob(),
    startNewJob(),
    startNewJob(),
    startNewJob(),
  ]).then(() => {
    console.log("all done!");
  }).catch((reason) => {
    console.error("Error occured", reason);
  });
}

export function loadEntrypoints(base, rootEntryPoints, apps) {
  for (let app of apps) {
    if (app === null)
      app = "";
    let appEntries = require(path.join(base, app, "entrypoints.json"));
    for (let entryName of Object.keys(appEntries)) {
      let normalized = (app + "/" + entryName).replace(/^\/|\/$/g, '');
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
        revision: md5.digest("hex")
      });
    }
    console.log(extraManifestEntries);
  } catch (e) {
    console.warn("Could not fetch entries, skipping.", e);
  }
  return extraManifestEntries;
}
