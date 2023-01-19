import picomatch from 'picomatch';

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

const getUncommitted = async (): Promise<string[]> => {
  const isIgnored = picomatch(IGNORE_UNCOMMITTED_FILES, { cwd: '/', basename: true });
  const uncommitted = (await spawn('git', ['status', '-s', '--porcelain']).assertSuccess().lines())
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

  return modified.length > 0;
};

const createTag = async (): Promise<void> => {
  const tagName = `release-${Date.now()}`;

  if (!(await spawn('git', ['config', 'user.name']).wait())) {
    await spawn('git', ['config', 'user.name', 'anglerci']).assertSuccess().wait();
    await spawn('git', ['config', 'user.email', 'anglerci@example.com']).assertSuccess().wait();
  }

  await spawn('git', ['tag', '-a', tagName, '-m', 'Released by Angler CI.']).assertSuccess().wait();
  await spawn('git', ['push', '--no-verify', 'origin', `refs/tags/${tagName}`])
    .assertSuccess()
    .wait();
};

const fetchUnshallow = async (): Promise<void> => {
  await spawn('git', ['fetch', '--unshallow']).wait();
};

const fetchRef = async (ref: string): Promise<void> => {
  if (await spawn('git', ['checkout', ref]).wait()) {
    await spawn('git', ['checkout', '-']).assertSuccess().wait();
  }
};

export { createTag, fetchRef, fetchUnshallow, getBaseRefTag, getFileAtRef, getUncommitted, isPathModified };
