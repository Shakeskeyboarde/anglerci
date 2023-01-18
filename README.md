# Angler CI

A validation-only approach to releasing projects which use NPM and Git.

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

Angler CI will use NPM workspaces if enabled. The project root is also considered to be a "workspace", and therefore the only workspace if workspaces are disabled. Only workspaces which are _non-private_ will be considered. Yarn and other workspace providers are not supported at this time.

Which workspaces are modified is determined by diffing each workspace directory against a base-ref. The base-ref is read from the `--base-ref` CLI option, `GITHUB_BASE_REF` environment variable, or the most recent Git annotated-tag. If no base-ref can be determined, then all workspaces are considered modified. If only the workspace `CHANGELOG.md` file is modified, then the workspace is considered unmodified, so that the changelogs can be repaired without requiring a new release.

Which workspaces are unpublished is determined by checking the configured NPM registry to see if the current `package.json` version exists.

## How it works

Angler CI works in two phases:

1. `catch`
   - Verify all changes are committed.
   - Verify versions in modified workspaces have increased.
   - Verify CHANGELOG.md contains an entry for the release version.
   - Verify CHANGELOG.md correctly documents the version increment level (major, minor, or patch).
   - Verify local dependency versions have been updated.
   - Verify local private dependencies are only used as devDependencies.
   - Verify new package versions are unpublished.
2. `release`
   - Verify that all changes have been committed.
   - Tag the commit which is being released.
   - Publish packages for all modified or unpublished workspaces.

The `npm install` command will automatically create symlinks for local dependencies (dependencies between workspaces in a monorepo), as long as the dependency version range matches the workspace version. Therefore, the `catch` command requires that all local dependencies either have the exact matching version, or range where the _minimum_ version is the current local workspace version.

Changelog updates are only enforced for workspaces that contain a `CHANGELOG.md` file. If the file exists, it must contain a heading (any level) with the current version number (leading `v` is optional). If the major version has increased, there must be a `Breaking Changes` subheading. Conversely, if there is a `Breaking Changes` subheading, the major version must be increased. The same is true for a `Features` subheading and the minor version. If neither of those headings is present, then only the patch version can be incremented. All headings are matched case-insensitively.

The `release` command will publish packages for all modified workspaces, as well as any workspaces with versions that are unpublished (even if unmodified). Publication is ordered by interdependency, so any local dependency will be published before its dependents.

The `release` command also creates a Git annotated-tag (`release-<timestamp>`), so that subsequent releases can identify which workspaces have modifications. The tag is created _before_ publishing. If publishing fails due to a transient error, retrying will still work because unpublished workspace versions are published in addition to any modified workspaces.

## Why it works this way

Angler CI expects developers to version and update the changelog directly, and it treats the PR as the moment of truth (instead of each commit). It catches things you might have forgotten. It does not try to do these things for you. At the end of they day, there is no substitute for agreed-upon conventions and peer review to ensure the quality of commit and changelog messaging.

Solutions like [conventional commits](https://www.conventionalcommits.org) seem like a good idea, but (IMO) generally don't decrease the amount of work, speed up iteration, reduce mistakes, or improve the quality of commit messages.

Pros:

- No non-user generated code changes in your CI pipeline.
- No extra commits/PRs for updating version numbers.
- No constraints on commit structuring or changelog formatting.
- No workflow learning curve requiring complicated commit fixups.

Cons:

- Simultaneous PRs may result in version "collisions". When a PR is resolved and merged, the effective "previous" version of all following PRs is updated. Updates may be required to these remaining PRs to re-increment version numbers. This is a minor task, and merging upstream changes will usually be required in follow-up PRs anyway.
