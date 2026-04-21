const cp = require('child_process');
const fs = require('fs');
try {
  const output = cp.execSync('npx tsc -b', { encoding: 'utf8' });
  console.log('No errors');
} catch (e) {
  fs.writeFileSync('clean-build-errors.txt', e.stdout, 'utf8');
}
