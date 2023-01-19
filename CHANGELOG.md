# Changelog

## v1.2.2

### Docs

- README.md polish.

## v1.2.1

### Docs

- Removed the space between "Angler" and "CI". The project name is officially "AnglerCI" (no space).
- Various README.md improvements.

### Internal

- Fetch tags (try, but ignore errors) before resolving modifications.

## v1.2.0

### Features

- [#4](https://github.com/Shakeskeyboarde/anglerci/issues/4): Add publishable packages to the release tag.
- Add `--no-uncommitted-check` option.

### CI

- [#3](https://github.com/Shakeskeyboarde/anglerci/issues/3): Moved NPM_TOKEN to a variable instead of writing it to the .npmrc file.

## v1.1.0

### Features

- Add automatic prerelease tagging for prerelease versions.
- Enforce prerelease versions when the `--prerelease` option is set.
- Disable commit tagging and publishing when the `release` command `--dry-run` option is set.

### Fixed

- Version diff incorrectly reporting major or minor due to an error parsing the previous package.json file.

## v1.0.0

### Major Release

- Promoting to v1.0.0
