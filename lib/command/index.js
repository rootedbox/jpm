import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function init(program) {
  const commandsPath = path.join(__dirname);
  const files = fs.readdirSync(commandsPath);

  for (const file of files) {
    if (file === "index.js") continue;

    const commandPath = path.join(commandsPath, file);
    const commandModule = await import(commandPath);

    const command = commandModule.default || commandModule;
    if (typeof command === "function") {
      command(program);
    } 
  }
}
