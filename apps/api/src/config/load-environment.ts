import { resolve } from 'node:path';
import { config } from 'dotenv';

const initialWorkingDirectory = process.env.INIT_CWD ?? process.cwd();

config({
  path: [
    resolve(process.cwd(), '../../.env'),
    resolve(initialWorkingDirectory, '../../.env'),
    resolve(process.cwd(), '.env'),
    resolve(initialWorkingDirectory, '.env'),
  ],
  quiet: true,
});
