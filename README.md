# webpack-critical-pages

[![npm version](https://badge.fury.io/js/webpack-critical-pages.svg)](https://badge.fury.io/js/webpack-critical-pages)

Automatically generate critical css for a well-defined paging structure on multiple entrypoints.  
Initially designed for project structures using Python's Django Web Framework.

Blends in well with ![webpack5-bundle-tracker](https://pypi.org/project/django-webpack5-loader/).

For each app, define an `entrypoints.json` file with the following structure:

```json
{
  "vocdashboard": {
    "file": "./pages/vocdashboard/dashboard.js",
    "exampleUrl": "/vocabulary/"
  },
  "search": {
    "file": "./pages/search/search.js",
    "exampleUrl": "/vocabulary/search/?q=friends",
    "totalEntrypoints": ["main", "vocabulary/search"]
  }
}
```

You may then use this node script for generating the critical css directly in the desired output folder:

```js
const criticalPages = require("webpack-critical-pages");

const BASE = path.dirname(__dirname);
const APPS = ["app1", "app2", "feedback"];
const pages = criticalPages.getCriticalPages(BASE, APPS);
criticalPages.extractCriticalCSS(pages).then(() => {
  console.log("Finished.");
});
```

Retrieve webpack entrypoints from the defined json files like this:

```js
const criticalPages = require("webpack-critical-pages");
const entrypoints = criticalPages.loadEntrypoints(BASE, ROOT_ENTRYPOINTS, APPS);
```

If you want to use a service worker, this package also provides automatic generation of hashes from fetched page content
to use in the fantastic workbox plugin for webpack. It will treat the dynamically generated pages as static content.

```js
const path = require("path");
const merge = require("webpack-merge");
const basePromise = require("./base.config.js");
const WorkboxPlugin = require("workbox-webpack-plugin");
const criticalPages = require("webpack-critical-pages");

const PAGES_TO_PRECACHE = [
  "/en/",
  "/de/",
  "/en/my-page/",
];

module.exports = async () => {
  let base = await basePromise();
  return merge.merge(base.config, {
    mode: "development",
    output: {
      path: path.resolve("./.dev/bundles"),
      filename: "[name].js"
    },
    module: {
      rules: [...]
    },
    plugins: [
      new WorkboxPlugin.InjectManifest({
        swSrc: "./frontend/service-worker.js",
        swDest: "sw.js",
        chunks: ["main", "landingpage"],
        additionalManifestEntries: await criticalPages.fetchPageEntries(PAGES_TO_PRECACHE)
      })
    ]
  });
}
```
