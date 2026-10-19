# Frontend source and historical prototypes

The maintained interface is social.html, social.mjs, social.css and client.mjs.
Start it from the repository root with `npm run dev`. The interface now requires
its Fastify API; a standalone Python static server does not run the current app.

See ../README.md for setup and ../docs/ARCHITECTURE.md for storage and boundaries.
The root `npm run build` command creates the production application in ../dist.

social-state.mjs contains the deterministic scenario executed by the server.
play.html / play.js and garden.html / garden.js are standalone playable previews.
The displayed repository modules are illustrative scenario sources, not complete
source trees of these playable previews.

github.*, minimal.*, source-data.js, social-app.js, social-state.js, index.html and
build*.mjs preserve earlier static iterations. Their historical build entry is
not the current development workflow. Earlier revisions also remain in Git.

Provider logos are from https://github.com/lobehub/lobe-icons; see
assets/LICENSE-lobe-icons.txt. The project is not affiliated with the providers.
