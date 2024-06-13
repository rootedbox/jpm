const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const jpmPath = path.resolve(__dirname, "../jpm.js");
const testProjectDir = path.resolve(__dirname, "./test-project");
const packageJsonPath = path.join(testProjectDir, "package.json");

describe("jpm add", () => {
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
    } else {
      fs.unlinkSync(packageJsonPath);
    }
  });

  beforeEach(() => {
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({ name: "test-project", version: "1.0.0" }, null, 2)
    );
  });

  test("should add a package to dependencies", () => {
    const result = spawnSync("node", [jpmPath, "add", "is-thirteen@1.0.0"], {
      cwd: testProjectDir,
      encoding: "utf-8",
    });

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson).toHaveProperty("dependencies");
    expect(packageJson.dependencies).toHaveProperty("is-thirteen");
    expect(packageJson.dependencies["is-thirteen"]).toBe("^1.0.0");
    expect(result.status).toBe(0);
  });
});
