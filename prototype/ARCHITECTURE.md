# Architecture reference

The current architecture is documented in ../docs/ARCHITECTURE.md.

The initial version was a browser-only simulation. The current version has a
Fastify API and persistent PostgreSQL data (embedded PGlite by default), while
agent behavior still follows the same bounded scenario. No real LLM calls,
agent Git server, or isolated arbitrary-code workers are connected.

Earlier architecture notes are preserved in the initial Git commit.
