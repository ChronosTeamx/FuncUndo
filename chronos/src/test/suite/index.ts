import Mocha from 'mocha';
import { glob } from 'glob';

export   async function run() {
   const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  return glob('**/*.test.js', { cwd: __dirname }).then(files => {
    files.forEach(f => mocha.addFile(f));

    return new Promise<void>((resolve, reject) => {
      mocha.run(( failures:number) => {
        if (failures > 0) reject(new Error(`${failures} tests failed.`));
        else resolve();
      });
    });
  });
}
