import { spawn as crossSpawn } from 'cross-spawn';
import { quote } from 'shell-quote';

type SpawnedProcess = {
  assertSuccess: () => SpawnedProcess;
  wait: () => Promise<boolean>;
  json: <TType = any>() => Promise<TType>;
  text: () => Promise<string>;
};

class SpawnError extends Error {
  readonly command: string;
  readonly exitCode: number;
  readonly output: string;
  readonly env: Readonly<Record<string, string | undefined>>;

  constructor(
    command: string,
    exitCode: number,
    output: string,
    env: Readonly<Record<string, string | undefined>> = {},
  ) {
    super(`Spawned process returned non-zero exit code (${exitCode}).`);
    this.command = command;
    this.exitCode = exitCode;
    this.output = output;
    this.env = env;
  }
}

const spawn = (command: string, args: string[]): SpawnedProcess => {
  let assert = false;
  let successPromise: Promise<boolean> | undefined;
  let textPromise: Promise<string> | undefined;
  let jsonPromise: Promise<any> | undefined;

  const promise = new Promise<{ buffer: Buffer; success: boolean }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const cp = crossSpawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    cp.on('error', reject);
    cp.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    cp.stderr.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    cp.on('close', () => {
      const buffer = Buffer.concat(chunks);
      const success = cp.exitCode === 0;

      if (cp.exitCode !== 0 && assert) {
        reject(new SpawnError(quote([command, ...args]), cp.exitCode || 1, buffer.toString()));
      } else {
        resolve({ buffer, success });
      }
    });
  });

  const self: SpawnedProcess = {
    assertSuccess: () => {
      assert = true;
      return self;
    },
    wait: () => successPromise ?? (successPromise = promise.then(({ success }) => success)),
    json: () => jsonPromise ?? (jsonPromise = self.text().then((text) => JSON.parse(text))),
    text: () => textPromise ?? (textPromise = promise.then(({ buffer }) => buffer.toString('utf8').trim())),
  };

  return self;
};

export { spawn, SpawnError };
