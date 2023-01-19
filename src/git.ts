import picomatch from 'picomatch';
import type * as semver from 'semver';

import { spawn } from './spawn.js';

const IGNORE_UNCOMMITTED_FILES = ['.npmrc'];
const IGNORE_MODIFIED_FILES = ['.npmrc', 'CHANGELOG.md'];

const getBaseRefTag = async (): Promise<string | null> => {
  return await spawn('git', ['describe', '--abbrev=0', '--first-parent'])
    .assertSuccess()
    .text()
    .catch(() => null);
};

const getFileAtRef = async (ref: string, filename: string): Promise<string> => {
  return await spawn('git', ['show', `${ref}:${filename}`])
    .assertSuccess()
    .text();
};

const getUncommitted = async (path = '.'): Promise<string[]> => {
  const isIgnored = picomatch(IGNORE_UNCOMMITTED_FILES, { cwd: '/', basename: true });
  const uncommitted = (await spawn('git', ['status', '-s', '--porcelain', path]).assertSuccess().lines())
    .map((line) => '/' + line.replace(/^.{2} /, ''))
    .filter((filename) => !isIgnored(filename));

  return uncommitted;
};

const isPathModified = async (baseRef: string, path: string, ignore: string[]): Promise<boolean> => {
  const isIgnored = picomatch([...ignore, ...IGNORE_MODIFIED_FILES], { cwd: '/', basename: true });
  const modified = (
    await spawn('git', ['diff', '--name-only', `${baseRef}..HEAD`, '--', path])
      .assertSuccess()
      .lines()
  )
    .map((line) => '/' + line)
    .filter((filename) => !isIgnored(filename));
  const uncommitted = await getUncommitted(path);

  return modified.length > 0 || uncommitted.length > 0;
};

const createTag = async (workspaces: { name: string; version: semver.SemVer }[]): Promise<void> => {
  const name = `release-${Date.now()}`;

  if (!(await spawn('git', ['config', 'user.name']).wait())) {
    await spawn('git', ['config', 'user.name', 'anglerci']).assertSuccess().wait();
    await spawn('git', ['config', 'user.email', 'anglerci@example.com']).assertSuccess().wait();
  }

  const message = `
Released by AnglerCI

${workspaces.map((workspace) => `+ ${workspace.name}@${workspace.version}`).join('\n')}

NOTE: The above packages were publishable at the time of the release.
      However, it's possible they were not successfully published after
      the tag was created.
    `.trim();

  await spawn('git', ['tag', '-a', name, '-m', message]).assertSuccess().wait();
  await spawn('git', ['push', '--no-verify', 'origin', `refs/tags/${name}`])
    .assertSuccess()
    .wait();
};

const fetchUnshallow = async (): Promise<void> => {
  await spawn('git', ['fetch', '--unshallow']).wait();
  await spawn('git', ['fetch', '--tags']).wait();
};

const fetchRef = async (ref: string): Promise<void> => {
  if (await spawn('git', ['checkout', ref]).wait()) {
    await spawn('git', ['checkout', '-']).assertSuccess().wait();
  }
};

export { createTag, fetchRef, fetchUnshallow, getBaseRefTag, getFileAtRef, getUncommitted, isPathModified };
