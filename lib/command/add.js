import fs from "fs";
import path from "path";
import packageJson from "package-json";

async function addPackage(packageName) {
  const [pkg, version] = packageName.split("@");
  const packageInfo = await packageJson(pkg, { version: version || "latest" });
  const pkgVersion = version || packageInfo.version;

  const packageJsonPath = path.resolve("package.json");

  if (!fs.existsSync(packageJsonPath)) {
    console.error("package.json not found. Please run npm init to create one.");
    process.exit(1);
  }

  const packageData = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  if (!packageData.dependencies) {
    packageData.dependencies = {};
  }

  packageData.dependencies[pkg] = `^${pkgVersion}`;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
  console.log(`Added ${pkg}@${pkgVersion} to dependencies.`);
}

export default function (program) {
  program
    .command("add <package_name>")
    .description("Add a package to dependencies in package.json")
    .action((packageName) => {
      addPackage(packageName).catch((error) => {
        console.error(error.message);
        process.exit(1);
      });
    });
}
