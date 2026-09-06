// Entry point compatible with ES Module ("type": "module" in package.json)
// and loads the compiled production server bundle
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./dist/server.cjs');
