#!/usr/bin/env node
/* eslint-disable max-lines */
import * as semver from 'semver';

import * as changelog from './changelog.js';
import { CustomCommand } from './command.js';
import * as git from './git.js';
import * as npm from './npm.js';
import { SpawnError } from './spawn.js';

const program = new CustomCommand();

program.name('angler').description('Bare bones Git annotated-tag versioning for monorepos.');

program
  .command('help', { isDefault: true, hidden: true })
  .description('Print this help text.')
  .action(async () => {
    program.help();
  });

program
  .command('catch')
  .aliases(['check', 'verify', 'validate', 'test'])
  .description('Verify that a changeset is ready for release.')
  .option('-b, --base-ref <ref>', 'The Git base reference for detecting modified workspaces')
  .option('--prerelease', 'Enforce prerelease versions')
  .option('--no-uncommitted-check', 'Disable uncommitted changes check')
  .allowExcessArguments(false)
  .allowUnknownOption(false)
  .action(async ({ baseRef = null, prerelease = false, uncommittedCheck }) => {
    await git.fetchUnshallow();

    baseRef ||= process.env.GITHUB_BASE_REF || (await git.getBaseRefTag()) || null;
    process.chdir(await npm.getPrefix());

    if (baseRef) {
      await git.fetchRef(baseRef);
    }

    // Verify all changes are committed.
    if (uncommittedCheck) {
      const uncommitted = await git.getUncommitted();

      if (uncommitted.length) {
        console.error('All changes must be committed.');
        uncommitted.forEach((filename) => console.error(`  ${filename}`));
        process.exitCode ??= 1;
        return;
      }
    }

    const workspaces = await npm.getWorkspaces(baseRef);
    const publishable = [...workspaces.values()].filter(
      (workspace) => !workspace.private && (workspace.modified || !workspace.published),
    );

    if (publishable.length === 0) {
      console.log('No modified or unpublished workspaces.');
      return;
    }

    for (const workspace of publishable) {
      const versionDiff = baseRef ? await npm.getVersionDiff(baseRef, workspace.location, workspace.version) : null;

      // Verify versions in modified workspaces have increased.
      if (baseRef && !versionDiff) {
        console.error(`${workspace.name}: Increment the version.`);
        process.exitCode ??= 1;
      }

      if (workspace.version.prerelease.length === 0) {
        if (prerelease) {
          console.error(`${workspace.name}: Use a prerelease version.`);
          process.exitCode ??= 1;
        }

        const changeLogDiff = await changelog.getChangeLogDiff(workspace.location, workspace.version);

        // Verify CHANGELOG.md contains an entry for the release version.
        if (changeLogDiff === 'missing') {
          console.error(`${workspace.name}: Add a ${workspace.version} section to the changelog.`);
          process.exitCode ??= 1;
        }
        // Verify CHANGELOG.md correctly documents the version increment.
        else if (changeLogDiff && versionDiff && changeLogDiff !== versionDiff) {
          if (changeLogDiff < versionDiff) {
            console.error(`${workspace.name}: Increment the ${changeLogDiff} version to match the changelog.`);
          } else {
            console.error(`${workspace.name}: Document the ${versionDiff} changes in the changelog.`);
          }

          process.exitCode ??= 1;
        }
      }

      // Verify local dependency versions have been updated.
      for (const dependencyType of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
        for (const [key, value] of Object.entries(workspace[dependencyType])) {
          const dependency = workspaces.get(key) as npm.Workspace;

          // Verify local private dependencies are only used as devDependencies.
          if (dependency.private) {
            console.error(
              `${workspace.name}: Move the local private ${JSON.stringify(
                key,
              )} dependency from ${dependencyType} to devDependencies.`,
            );
            process.exitCode ??= 1;
            continue;
          }

          const minVersion = semver.minVersion(value);

          if (!minVersion || !semver.eq(minVersion, dependency.version)) {
            console.error(
              `${workspace.name}: Update the ${JSON.stringify(key)} dependency version range to make ${
                dependency.version
              } the lower bound.`,
            );
            process.exitCode ??= 1;
          }
        }
      }

      // Verify new workspace versions are unpublished.
      if (workspace.published) {
        console.error(`${workspace.name}: Use an unpublished version.`);
        process.exitCode ??= 1;
      }
    }

    if (!process.exitCode) {
      console.log('All modified or unpublished workspaces are ready for release.');
    }
  });

program
  .command('release')
  .aliases(['publish', 'deploy'])
  .description('Publish packages for all modified or unpublished workspaces.')
  .option('-b, --base-ref <ref>', 'The Git base reference for detecting modified workspaces')
  .option('--prerelease', 'Enforce prerelease versions')
  .option('--dry-run', 'Disable commit tagging and publishing')
  .option('--no-tag', 'Disable commit tagging')
  .option('--no-uncommitted-check', 'Disable uncommitted changes check')
  .allowExcessArguments(false)
  .allowUnknownOption(false)
  .action(async ({ baseRef = null, prerelease = false, tag, dryRun = false, uncommittedCheck }) => {
    await git.fetchUnshallow();

    baseRef ||= process.env.GITHUB_BASE_REF || (await git.getBaseRefTag()) || null;
    process.chdir(await npm.getPrefix());

    if (baseRef) {
      await git.fetchRef(baseRef);
    }

    // Verify all changes are committed.
    if (uncommittedCheck) {
      const uncommitted = await git.getUncommitted();

      if (uncommitted.length) {
        console.error('All changes must be committed.');
        uncommitted.forEach((filename) => console.error(`  ${filename}`));
        process.exitCode ??= 1;
        return;
      }
    }

    const workspaces = await npm.getWorkspaces(baseRef);
    const publishable = [...workspaces.values()].filter(
      (workspace) => !workspace.private && (workspace.modified || !workspace.published),
    );

    if (publishable.length === 0) {
      console.log('No modified or unpublished workspaces.');
      return;
    }

    // Tag the commit which is being released.
    if (tag && !dryRun) {
      await git.createTag(publishable);
    }

    // Publish packages for all modified or unpublished workspaces.
    for (const workspace of workspaces.values()) {
      if (!publishable.includes(workspace)) {
        console.log(
          `${workspace.name}: Skipped v${workspace.version} (${
            workspace.private ? 'private' : 'unmodified, published'
          }).`,
        );
        continue;
      }

      if (prerelease && workspace.version.prerelease.length === 0) {
        console.error(`${workspace.name}: Use a prerelease version.`);
        process.exitCode ??= 1;
        return;
      }

      process.stdout.write(
        `${workspace.name}: Publishing v${workspace.version} (${workspace.modified ? 'modified' : 'unpublished'})...`,
      );

      try {
        await npm.publish(workspace.location, workspace.version.prerelease.length > 0, dryRun);
        console.log('succeeded.');
      } catch (err) {
        console.log('failed.');
        throw err;
      }
    }
  });

await program.parseAsync().catch((error) => {
  if (error instanceof SpawnError) {
    Object.entries(error.env).forEach(([key, value]) => {
      if (value != null) {
        console.error(`${key}=${value}`);
      }
    });
    console.error(`> ${error.command}`);
    console.error(error.output);
    process.exitCode ??= error.exitCode;
  } else {
    console.error(process.env.DEBUG ? error : `${error}`);
    process.exitCode ??= 1;
  }
});
