#!/usr/bin/env node
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
  .description('Verify that a changeset is ready for release.')
  .option('-b, --base-ref <ref>', 'The Git base reference for detecting modified workspaces')
  .allowExcessArguments(false)
  .allowUnknownOption(false)
  .action(async ({ baseRef = null }) => {
    baseRef ||= process.env.GITHUB_BASE_REF || (await git.getBaseRefTag()) || null;
    process.chdir(await npm.getPrefix());

    // Verify all changes are committed.
    if (!(await git.isCommitted())) {
      console.error('All changes must be committed.');
      process.exitCode ??= 1;
      return;
    }

    const workspaces = await npm.getWorkspaces(baseRef);

    if ([...workspaces.values()].every((workspace) => !workspace.modified && !workspace.published)) {
      console.log('No modified or unpublished workspaces.');
      return;
    }

    for (const [name, workspace] of workspaces) {
      if (!workspace.modified && workspace.published) {
        continue;
      }

      const versionDiff = baseRef ? await npm.getVersionDiff(baseRef, workspace.location, workspace.version) : null;

      // Verify versions in modified workspaces have increased.
      if (baseRef && !versionDiff) {
        console.error(`${name}: Increment the version.`);
        process.exitCode ??= 1;
      }

      const changeLogDiff = await changelog.getChangeLogDiff(workspace.location, workspace.version);

      // Verify CHANGELOG.md contains an entry for the release version.
      if (changeLogDiff === 'missing') {
        console.error(`${name}: Add a ${workspace.version} section to the changelog.`);
        process.exitCode ??= 1;
      }
      // Verify CHANGELOG.md correctly documents the version increment.
      else if (changeLogDiff && versionDiff && changeLogDiff !== versionDiff) {
        if (changeLogDiff < versionDiff) {
          console.error(`${name}: Increment the ${changeLogDiff} version to match the changelog.`);
        } else {
          console.error(`${name}: Documentation the ${versionDiff} changes in the changelog.`);
        }

        process.exitCode ??= 1;
      }

      // Verify local dependency versions have been updated.
      for (const dependencyType of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
        for (const [key, value] of Object.entries(workspace[dependencyType])) {
          const currentVersion = workspaces.get(key)?.version;

          if (!currentVersion) {
            continue;
          }

          const minVersion = semver.minVersion(value);

          if (!minVersion || !semver.eq(minVersion, currentVersion)) {
            console.error(
              `${name}: Update the ${dependencyType}[${JSON.stringify(
                key,
              )}] version range to make ${currentVersion} the lower bound.`,
            );
            process.exitCode ??= 1;
          }
        }
      }

      // Verify new package versions are unpublished.
      if (await npm.isPublished(workspace.name, workspace.version)) {
        console.error(`${name}: Use an unpublished version.`);
        process.exitCode ??= 1;
      }
    }

    if (!process.exitCode) {
      console.log('All modified or unpublished workspaces are ready for release.');
    }
  });

program
  .command('release')
  .description('Publish packages for all modified or unpublished workspaces.')
  .option('-b, --base-ref <ref>', 'The Git base reference for detecting modified workspaces')
  .option('--no-tag', 'Disable automatic commit tagging')
  .allowExcessArguments(false)
  .allowUnknownOption(false)
  .action(async ({ baseRef = null, tag }) => {
    baseRef ||= process.env.GITHUB_BASE_REF || (await git.getBaseRefTag()) || null;
    process.chdir(await npm.getPrefix());

    // Verify all changes are committed.
    if (!(await git.isCommitted())) {
      console.error('All changes must be committed.');
      process.exitCode ??= 1;
      return;
    }

    const workspaces = await npm.getWorkspaces(baseRef);

    if ([...workspaces.values()].every((workspace) => !workspace.modified && !workspace.published)) {
      console.log('No modified or unpublished workspaces.');
      return;
    }

    // Tag the commit which is being released.
    if (tag) {
      await git.createTag();
    }

    // Publish packages for all modified or unpublished workspaces.
    for (const [name, workspace] of workspaces) {
      if (!workspace.modified && workspace.published) {
        console.log(`Skipping ${name}@${workspace.version} (already published).`);
        continue;
      }

      process.stdout.write(
        `Publishing ${name}@${workspace.version} (${workspace.modified ? 'modified' : 'unpublished'})...`,
      );

      try {
        await npm.publish(workspace.location);
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
