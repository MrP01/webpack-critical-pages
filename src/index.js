const penthouse = require("penthouse");
const path = require("path");
const fs = require("fs");
const bent = require("bent");

const requestBuffer = bent("buffer");

export function extractCriticalCSS(base, apps, criticalPages) {
  for (const app of apps) {
    const appEntries = require(path.join(base, app, "entrypoints.json"));
    for (const entryName of Object.keys(appEntries)) {
      criticalPages.push({
        "entrypoint": app + "/" + entryName,
        "exampleUrl": appEntries[entryName].exampleUrl
      });
    }
  }
  const dist = path.resolve(process.argv[2]);
  const webpackStats = require(path.resolve(process.argv[3]));
  const lang = "en";  // language to use for fetching pages
  const penthouseOptions = {};

  function getEntryPointCSS(entrypoint) {
    let cssString = "";
    const grps = webpackStats.entryPoints[entrypoint];
    for (const grp of grps) {
      for (const file of grp) {
        if (/\.css$/.test(file.name)) {
          cssString += fs.readFileSync(path.join(dist, file.path));
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
      url: `http://localhost:3141/${lang}${page.exampleUrl}`,
      cssString: totalEntrypoints.map(getEntryPointCSS).join(""),
      ...penthouseOptions
    }).then(criticalCss => {
      fs.writeFileSync(path.join(dist, page.entrypoint + ".critical.css"), criticalCss);
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
    let appEntries = require(path.join(base, app, "entrypoints.json"));
    for (let entryName of Object.keys(appEntries)) {
      rootEntryPoints[app + "/" + entryName] = "./" + path.join(app, appEntries[entryName].file);
    }
  }
  return rootEntryPoints;
}

export async function fetchPageEntries(pagesToPrecache) {
  let extraManifestEntries = [];
  try {
    let devServerUrl = process.env.DEV_SERVER_URL ? process.env.DEV_SERVER_URL : "http://127.0.0.1:8000";
    console.log("calculating page hashes from local dev server...");
    for (var i = 0; i < pagesToPrecache.length; i++) {
      var pagePath = pagesToPrecache[i];
      var fullUrl = devServerUrl + pagePath;
      var response = await requestBuffer(fullUrl);
      var md5 = crypto.createHash("md5");
      md5.update(response);
      extraManifestEntries.push({
        url: pagePath,
        revision: md5.digest("hex")
      });
    }
    console.log(extraManifestEntries);
  } catch (e) {
    console.warn("Could not fetch entries, skipping.");
  }
  return extraManifestEntries;
}
