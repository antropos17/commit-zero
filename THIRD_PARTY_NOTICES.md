# Third-party notices

The [AGPL-3.0 license](LICENSE) applies to original Commit Zero material.
Third-party software, fonts and marks retain their own terms. This notice does not
relicense them or grant trademark rights.

## Included interface assets

| Material                                    | Source and version                                                                                     | Terms and retained notice                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation/action icons                     | [GitHub Octicons](https://github.com/primer/octicons), `@primer/octicons` 19.40.0                      | MIT; [full notice](prototype/assets/icons/LICENSE)                                                                                                   |
| OpenAI, Anthropic and Google provider marks | [LobeHub lobe-icons](https://github.com/lobehub/lobe-icons)                                            | MIT artwork notice retained in [LICENSE-lobe-icons.txt](prototype/assets/LICENSE-lobe-icons.txt); underlying marks belong to their respective owners |
| Mona Sans variable font                     | [Mona Sans](https://github.com/github/mona-sans), `@fontsource-variable/mona-sans` 5.3.0               | SIL Open Font License 1.1; [full notice](prototype/assets/licenses/Mona-Sans-OFL.txt), including its reserved font name                              |
| Noto Sans variable font                     | [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic), `@fontsource-variable/noto-sans` 5.3.0 | SIL Open Font License 1.1; [full notice](prototype/assets/licenses/Noto-Sans-OFL.txt)                                                                |

The build copies the asset notices into `dist/assets`. Provider marks identify
participants in the demonstration and local product; they do not imply affiliation,
endorsement or a connected provider API. The Commit Zero commit-graph mark is
project-authored. See [asset provenance](prototype/assets/README.md).

## Package dependencies

`package-lock.json` pins direct and transitive dependencies and records their
available license metadata. `npm ci` installs their upstream packages and license
files; this repository does not vendor `node_modules`.

Direct runtime packages currently use these licenses:

| Packages                                                                                           | License    |
| -------------------------------------------------------------------------------------------------- | ---------- |
| `@electric-sql/pglite`                                                                             | Apache-2.0 |
| `@fastify/rate-limit`, `@fastify/static`, `fastify`, `pg`, `proper-lockfile`, `react`, `react-dom` | MIT        |
| `@fontsource-variable/mona-sans`, `@fontsource-variable/noto-sans`                                 | OFL-1.1    |

This table is an orientation aid, not a complete transitive license manifest.
When redistributing dependencies or compiled output, retain the applicable
upstream licenses, copyright notices and any required notices from the exact
installed versions. Development packages keep their own upstream terms as well.

## Optional inference downloads

The Windows setup script downloads [llama.cpp b11719](https://github.com/ggml-org/llama.cpp/tree/b11719)
(MIT) and [Qwen2.5-Coder-7B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/tree/13fb94bfda8c8cf22497dc57b78f391a9acb426a)
(Apache-2.0). The pinned URLs and hashes are recorded in
[the setup script](scripts/setup-local-model.ps1). Binaries and weights are not
included in this source release. Their upstream licenses apply to those downloads.

## Optional local development skills

Optional agent skills used during local development are separate third-party
tools, not part of the published application source snapshot. A local checkout may
retain `.agents/skills` for the operator. Those copies are excluded from source
publication because their complete version-specific redistribution notices and
provenance were not established. This includes their bundled scripts and data.
They are not required to install, build, check or run Commit Zero. AGPL-3.0 does not
grant redistribution rights to omitted upstream tools.
