import { type Command, Help } from '@commander-js/extra-typings';

class CustomHelp extends Help {
  commandDescription(cmd: Command) {
    return this.wrap(cmd.description() ?? '', process.stdout.columns || 79, 0);
  }
}

export { CustomHelp };
