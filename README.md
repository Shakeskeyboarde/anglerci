# AnglerCI

A validation-only approach to releasing projects using NPM and Git.

## Requirements

- Git >= v2.19.2
- NodeJS >= v14.17.0
- NPM >= v8.16.0

## Getting started

Install as a dev dependency.

```sh
npm i -D anglerci
```

Verify that a changeset is ready for release. Run this in your PR validation pipeline.

```sh
npx angler catch
```

Publish packages for all modified or unpublished workspaces. This will also create an annotated tag for the current commit. Run this in your release pipeline.

```sh
npx angler release
```

NPM workspaces are used if enabled. The project root is also considered to be a "workspace" (the only one if workspaces are disabled). Only workspaces which are _non-private_ will be considered. Yarn and other workspace providers are not supported at this time.

Workspaces with modifications are detected by diffing each workspace directory against a base-ref. The base-ref is read from the `--base-ref` CLI option, `GITHUB_BASE_REF` environment variable, or the most recent Git annotated-tag. If no base-ref can be determined, then all workspaces are considered modified.

Workspaces which are unpublished are detected by checking whether the current `package.json` version exists the configured NPM registry.

## How it works

There are two phases:

1. `catch`
   - Verify all changes are committed.
   - Verify versions in modified workspaces have increased.
   - Verify CHANGELOG.md contains an entry for the release version.
   - Verify CHANGELOG.md correctly documents the version increment (major, minor, or patch).
   - Verify local dependency versions have been updated.
   - Verify local private dependencies are only used as devDependencies.
   - Verify incremented workspace versions are unpublished.
2. `release`
   - Verify all changes are committed.
   - Tag the commit which is being released.
   - Publish packages for all modified or unpublished workspaces.

The `npm install` command automatically creates symlinks for local dependencies (dependencies between workspaces in a monorepo), as long as the dependency version range matches the workspace version. Therefore, the `catch` command requires that all local dependencies either have the exact matching version, or range where the _minimum_ version is the current local workspace version.

Changelog updates are only enforced for workspaces that contain a `CHANGELOG.md` file. If the file exists, it must contain a heading (any level) with the current version number (leading `v` is optional). If the major version has increased, there must be a subheading which contains the word `breaking`/`major`. Conversely, if there is a `breaking`/`major` subheading, the major version must be increased. The same is true for a `features`/`enhancements`/`minor` subheading and the minor version. If none of those headings are present, then only the patch version can be incremented. All headings are matched partially, case-insensitively, and pluralization is optional. Some recommended heading keywords for patches are: `fixes`, `build`, `chores`, `ci`, `docs`, `styles`, `refactors`, `perf`, `tests`.

The `release` command will publish packages for all modified workspaces, as well as any workspaces with versions that are unpublished (even if not modified). Publication is ordered by interdependency, so any local dependency will be published before its dependents.

The `release` command also creates a Git annotated-tag (`release-<timestamp>`), so that subsequent releases can identify which workspaces have modifications. The tag is created _before_ publishing. If publishing fails due to a transient error, retrying should still publish the tagged modifications (which will now appear to be unmodified), because the versions will still be unpublished.

## Why it works this way

Developers are expected to update versions and changelogs as part of their regular commit work. The PR is treated as the moment of truth (instead of each commit). The tool only catches things you might have forgotten. It does not try to do these things for you. At the end of they day, there is no substitute for agreed-upon conventions and peer review to ensure the quality of commit and changelog messaging.

Solutions like [conventional commits](https://www.conventionalcommits.org) seem like a good idea, but (IMO) generally don't decrease the amount of work, speed up iteration, reduce mistakes, or improve the quality of commit messages.

Pros:

- No non-user generated code changes in your CI pipeline.
- No extra commits/PRs for updating version numbers.
- No constraints on commit structuring or changelog formatting.
- No workflow learning curve requiring complicated commit fixups.

Cons:

- Simultaneous PRs may result in version "collisions". When a PR is resolved and merged, the effective "previous" version of all following PRs is updated. Updates may be required to these remaining PRs to re-increment version numbers. This is a minor task, and merging upstream changes will usually be required in follow-up PRs anyway.

## Ignoring Modifications

Changes to `CHANGELOG.md` files are always ignored, because they have no effect on the build output, and it's useful to be able to update them without causing a new release.

Additional files can be ignored when detecting workspace modifications by adding globs to the `config.anglerci.ignore` array in `package.json` files. Matching is done with the [picomatch](https://www.npmjs.com/package/picomatch) package, and works similarly to `.gitignore` rules.

```json
{
  "config": {
    "anglerci": {
      "ignore": ["*.md"]
    }
  }
}
```

## Prerelease

To create a prerelease, include a [prerelease](https://semver.org/#spec-item-9) part in a `package.json` version (eg. `1.0.0-prerelease.0`). When a workspace has a prerelease version, the following things happen:

- No `CHANGELOG.md` section is required for the prerelease version.
- A NPM non-latest publish tag (`--tag=prerelease`) is set if the `publishConfig.tag` option in the `package.json` file is empty.

Use the `--prerelease` option to enforce prerelease versions (eg. from unprotected branches).

## Git Pre-Push Hook

The `catch` command can also be used as a Git `pre-push` hook. This is not a replacement for a PR pipeline check, but it can help to call out potential problems earlier.

The recommended approach is to use [Husky](https://www.npmjs.com/package/husky), so that hooks are installed automatically whenever a developer runs the `npm install` command.

1. Install Husky.
   - `npm i -D husky`
   - `npm pkg set scripts.prepare="husky install"`
   - `npm run prepare`
2. Add the pre-push hook.
   - `npx husky add .husky/pre-push "angler catch"`
   - `git add .husky/pre-push`

Now the `catch` command will run whenever you use the Git `push` command.
