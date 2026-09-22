# Anti-slop provenance

Source repository: unknown. The plugin was copied from the bundled `install-anti-slop` skill assets at `/home/ruan/.agents/skills/install-anti-slop/assets/anti-slop`.

Source revision: unknown. The pristine copied snapshot has the deterministic file-set SHA-256 digest `522bcddcf8678e0e571f0b7bcbea4732637e36e7183ad78aefc1bba8be58b161`, computed by sorting all source file paths, hashing each file with `sha256sum`, and hashing that output again.

Installed paths:

- `tools/oxlint/anti-slop/index.ts` and its generic rules and shared helpers
- `tools/oxlint/anti-slop/effect/` (copied but not registered because this project does not directly depend on Effect)
- `tools/oxlint/anti-slop/vendor/eslint-stylistic/`, including its license and separate upstream record

Intentional deviations:

- None in the copied plugin source.
- `.pi/**` is deliberately not ignored by Oxlint because this repository owns and publishes `.pi/extensions/polyglot.ts` as application source.
