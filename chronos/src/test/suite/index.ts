import Mocha from 'mocha';
import { glob } from 'glob';
import * as path from 'path';

export   async function run() {
   const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  return glob('**/*.test.js', { cwd: __dirname }).then(files => {
    files.forEach(f => mocha.addFile(path.resolve(__dirname, f)));

    return new Promise<void>((resolve, reject) => {
      mocha.run(( failures:number) => {
        if (failures > 0) reject(new Error(`${failures} tests failed.`));
        else resolve();
      });
    });
  });
}
