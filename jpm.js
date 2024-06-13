#!/usr/bin/env node

import { program } from "commander";
import { init } from "./lib/command/index.js"; 

program
  .name("jpm")
  .description("Kind of like NPM but with less functionality.");

await init(program);

program.parse(process.argv);
