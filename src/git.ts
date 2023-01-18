import { spawn } from './spawn.js';

const getBaseRefTag = async (): Promise<string | null> => {
  return await spawn('git', ['describe', '--abbrev=0', '--first-parent'])
    .assertSuccess()
    .text()
    .catch(() => null);
};

const getFileAtRef = async (ref: string, filename: string): Promise<string> => {
  const diff = await spawn('git', ['show', `${ref}:${filename}`])
    .assertSuccess()
    .text();

  return diff.replace(/^(.)(.*(?:\n\r?|$))/gmu, (_, prefix, suffix) =>
    prefix !== ' ' && prefix !== '-' ? '' : suffix,
  );
};

const isCommitted = async (): Promise<boolean> => {
  return (await spawn('git', ['status', '-s', '--porcelain']).assertSuccess().text()) == '';
};

const isPathModified = async (baseRef: string, path: string): Promise<boolean> => {
  const modifiedFilesOutput = await spawn('git', ['diff', '--name-only', `${baseRef}..HEAD`, '--', path])
    .assertSuccess()
    .text();

  // At least one file is modified that is not CHANGELOG.md
  return modifiedFilesOutput !== '' && modifiedFilesOutput !== 'CHANGELOG.md';
};

const createTag = async (): Promise<void> => {
  const tagName = `release-${Date.now()}`;

  await spawn('git', ['tag', '-a', '-m', 'Released by Angler CI.', tagName]).assertSuccess().wait();
  await spawn('git', ['push', '--no-verify', 'origin', `refs/tags/${tagName}`])
    .assertSuccess()
    .wait();
};

const fetchAll = async (): Promise<void> => {
  await spawn('git', ['fetch', '--all', 'refs/heads/*:refs/remotes/origin/*']).wait();
};

const fetchRef = async (ref: string): Promise<void> => {
  await spawn('git', ['fetch', 'origin', ref, '--depth=1']).wait();
};

export { createTag, fetchAll, fetchRef, getBaseRefTag, getFileAtRef, isCommitted, isPathModified };
