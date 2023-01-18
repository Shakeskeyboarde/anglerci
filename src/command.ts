import { type Help, Command } from '@commander-js/extra-typings';

import { CustomHelp } from './help.js';

class CustomCommand extends Command {
  createHelp(): Help {
    return new CustomHelp();
  }
  createCommand(name?: string | undefined): Command {
    return new CustomCommand(name);
  }
}

export { CustomCommand };
