# Narly

[![Build Status](https://travis-ci.org/mcmathja/narly.svg)](https://travis-ci.org/mcmathja/narly)

Narly is a [functional reactive programming](https://en.wikipedia.org/wiki/Functional_reactive_programming) library for JavaScript. It aims to build off of the performance improvements realized by projects such as [Kefir](http://rpominov.github.io/kefir/), while providing a simpler codebase and cleaner API for developers.

Narly is under active development. **Contributions are welcomed**, particularly for missing base API features - please see [Issues](https://github.com/mcmathja/narly/issues).

# Development

Narly builds as a UMD module using [gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md). To make all files in `/dist`, run the following from the repo directory:

```sh
# Gets dev dependencies
npm install

# Builds project
gulp build
```

To run tests:

```sh
npm tests
```