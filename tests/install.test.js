const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const jpmPath = path.resolve(__dirname, "../jpm.js");
const testProjectDir = path.resolve(__dirname, "./test-project");
const packageJsonPath = path.join(testProjectDir, "package.json");
const nodeModulesPath = path.join(testProjectDir, "node_modules");

describe("jpm install", () => {
  let originalPackageJson;

  beforeAll(() => {
    if (fs.existsSync(packageJsonPath)) {
      originalPackageJson = fs.readFileSync(packageJsonPath, "utf-8");
    }
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir);
    }
  });

  afterAll(() => {
    if (originalPackageJson) {
      fs.writeFileSync(packageJsonPath, originalPackageJson);
    }
    
    if (fs.existsSync(nodeModulesPath)) {
      fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const initialPackageJson = {
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "is-thirteen": "^1.0.0",
        "left-pad": "^1.3.0",
      },
    };

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(initialPackageJson, null, 2)
    );
  });

  afterEach(() => {
    if (fs.existsSync(nodeModulesPath)) {
      fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    }
  });

  test("should install dependencies from package.json", () => {
    const result = spawnSync("node", [jpmPath, "install"], {
      cwd: testProjectDir,
      encoding: "utf-8",
    });

    console.log(result.stdout);
    console.log(result.stderr);

    expect(result.status).toBe(0);

    expect(fs.existsSync(nodeModulesPath)).toBe(true);

    const isThirteenPath = path.join(nodeModulesPath, "is-thirteen");
    const leftPadPath = path.join(nodeModulesPath, "left-pad");

    expect(fs.existsSync(isThirteenPath)).toBe(true);
    expect(fs.existsSync(leftPadPath)).toBe(true);
  });
});
