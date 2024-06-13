import fs from "fs";
import path from "path";
import https from "https";
import packageJson from "package-json";
import ora from "ora";
import { exec } from "child_process";
import util from "util";
import os from "os";
import crypto from "crypto";

const execPromise = util.promisify(exec);

async function fetchPackageInfo(packageName) {
  let pkg, version;

  if (packageName.startsWith("@")) {
    const atParts = packageName.split("@");
    pkg = `@${atParts[1]}`;
    version = atParts.length > 2 ? atParts[2] : "latest";
  } else {
    [pkg, version] = packageName.split("@");
    version = version || "latest";
  }

  return await packageJson(pkg, { version });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });

        fileStream.on("error", (err) => {
          reject(err);
        });
      })
      .on("error", (e) => {
        reject(new Error(`Failed to fetch tarball: ${e.message}`));
      });
  });
}

async function calculateFileChecksum(filePath, algorithm = "sha512") {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("base64"));
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

async function fetchAndSavePackage(pkg, version, nodeModulesPath) {
  const packageInfo = await fetchPackageInfo(`${pkg}@${version}`);
  const tarballUrl = packageInfo.dist.tarball;
  const tarballFilename = path.basename(tarballUrl);

  const expectedChecksum = packageInfo.dist.integrity.split("-").pop();

  const pkgPath = path.join(nodeModulesPath, pkg);
  const cacheDir = path.join(os.homedir(), ".jpm", "cache");

  const spinner = ora(`Downloading ${pkg}@${version}`).start();

  try {
    // Ensure the cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Define the cache file path using the tarball filename
    const cachedFilePath = path.join(cacheDir, tarballFilename);

    if (!fs.existsSync(cachedFilePath)) {
      // Download the tarball to the cache if it does not already exist
      await downloadFile(tarballUrl, cachedFilePath);

      // Validate checksum right after downloading
      const fileChecksum = await calculateFileChecksum(cachedFilePath);
      if (fileChecksum !== expectedChecksum) {
        throw new Error(`Checksum mismatch for ${pkg}@${version}`);
      }
    } else {
      spinner.info(`Using cached file for ${pkg}@${version}`);

      // Always validate checksum of the cached file before using it
      const fileChecksum = await calculateFileChecksum(cachedFilePath);
      if (fileChecksum !== expectedChecksum) {
        throw new Error(
          `Checksum mismatch for cached file of ${pkg}@${version}`
        );
      }
    }

    // Ensure the target node_modules package path exists
    if (!fs.existsSync(pkgPath)) {
      fs.mkdirSync(pkgPath, { recursive: true });
    } else {
      // Remove existing package directory to avoid ENOTEMPTY error
      fs.rmSync(pkgPath, { recursive: true, force: true });
    }

    // Create a temporary directory to extract the tarball
    const tmpExtractPath = path.join(nodeModulesPath, ".tmp_extract", pkg);
    if (!fs.existsSync(tmpExtractPath)) {
      fs.mkdirSync(tmpExtractPath, { recursive: true });
    } else {
      // Clean up any existing extraction
      fs.rmSync(tmpExtractPath, { recursive: true, force: true });
      fs.mkdirSync(tmpExtractPath, { recursive: true });
    }

    // Extract the tarball from the cache to the temporary directory
    await execPromise(`tar -xzf ${cachedFilePath} -C ${tmpExtractPath}`);

    // Move extracted contents to the target directory
    const extractedDir = path.join(tmpExtractPath, "package");
    if (fs.existsSync(extractedDir)) {
      fs.renameSync(extractedDir, pkgPath);
      fs.rmSync(tmpExtractPath, { recursive: true, force: true });
    } else {
      throw new Error(
        `Unexpected package structure in tarball for ${pkg}@${version}`
      );
    }

    spinner.succeed(`Installed ${pkg}@${version}`);
  } catch (error) {
    spinner.fail(`Failed to install ${pkg}@${version}: ${error.message}`);
    throw error;
  }
}

async function installDependencies(
  dependencies,
  nodeModulesPath,
  installStack = [],
  allDependencies = []
) {
  if (!fs.existsSync(nodeModulesPath)) {
    fs.mkdirSync(nodeModulesPath, { recursive: true });
  }

  for (const [pkg, versionRange] of Object.entries(dependencies)) {
    const versionParts = versionRange.split("||").map((part) => part.trim());

    const latestVersionPart = versionParts[versionParts.length - 1];

    const version = latestVersionPart.replace("^", "");
    const pkgIdentifier = `${pkg}@${version}`;

    // Check for circular dependencies
    if (installStack.includes(pkgIdentifier)) {
      console.warn(
        `Warning: Circular dependency detected: ${installStack.join(
          " -> "
        )} -> ${pkgIdentifier}`
      );
      continue;
    }

    let installModulesPath = nodeModulesPath;
    // Avoid processing the same package multiple times
    if (allDependencies.includes(pkgIdentifier)) {
        continue;
    } else {
        if (allDependencies.find((dep) => dep.startsWith(`${pkg}@`))) {
            installModulesPath = path.join(
              installModulesPath,
              `${pkg}`,
              "node_modules"
            );
        } else {
            allDependencies.push(pkgIdentifier);
        }
    }

    installStack.push(pkgIdentifier);

    try {
      await fetchAndSavePackage(pkg, version, installModulesPath);

      const packageInfo = await fetchPackageInfo(pkgIdentifier);
      if (packageInfo.dependencies) {
        await installDependencies(
          packageInfo.dependencies,
          nodeModulesPath,
          installStack,
          allDependencies
        );
      }
    } catch (error) {
      console.error(`Failed to install ${pkgIdentifier}: ${error.message}`);
    } finally {
      installStack.pop();
      cleanUpTemporaryDirectory(path.join(nodeModulesPath, ".tmp_extract"));
    }
  }
}

async function cleanUpTemporaryDirectory(tmpExtractPath) {
  if (fs.existsSync(tmpExtractPath)) {
    fs.rmSync(tmpExtractPath, { recursive: true, force: true });
  }
}

async function install() {
  const packageJsonPath = path.resolve("package.json");
  const nodeModulesPath = path.resolve("node_modules");

  if (!fs.existsSync(packageJsonPath)) {
    console.error("package.json not found. Please run npm init to create one.");
    process.exit(1);
  }

  const packageData = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  if (packageData.dependencies) {
    const allDependencies = [];
    const installStack = [];
    await installDependencies(
      packageData.dependencies,
      nodeModulesPath,
      installStack,
      allDependencies
    );
  } else {
    console.log("No dependencies found in package.json");
  }
}

export default function (program) {
  program
    .command("install")
    .description("Install all packages listed in dependencies in package.json")
    .action(() => {
      install().catch((error) => {
        console.error(error.message);
        process.exit(1);
      });
    });
}
