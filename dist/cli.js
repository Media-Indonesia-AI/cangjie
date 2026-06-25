#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerArticles } from './commands/articles.js';
import { registerTickers } from './commands/tickers.js';
import { registerTopics } from './commands/topics.js';
import { registerStories } from './commands/stories.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const program = new Command();
program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version)
    .showHelpAfterError()
    .configureOutput({
    writeErr: (str) => process.stderr.write(str),
});
registerArticles(program);
registerTickers(program);
registerTopics(program);
registerStories(program);
program.parseAsync(process.argv).catch((err) => {
    process.stderr.write(`✗ ${err.message}\n`);
    process.exit(5);
});
//# sourceMappingURL=cli.js.map