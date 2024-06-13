const { spawnSync } = require('child_process');
const path = require('path');

describe('jpm CLI', () => {
  const jpmPath = path.resolve(__dirname, '../jpm.js');

  test('jpm', () => {
    const result = spawnSync('node', [jpmPath, 'help'], {
      encoding: 'utf-8'
    });
    
     expect(result.stdout).toContain("Usage: jpm [options] [command]");
     expect(result.stderr).toBe("");
     expect(result.status).toBe(0);
  });
});