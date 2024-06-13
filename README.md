# jpm

My very basic Node.js package manager.

## Packages Used

- **axios**
- **commander**
- **ora**
- **package-json**
- **tar**

## Overview

The goal of this project was to create a basic package manager that demonstrates my general abilities and coding philosophy within approximately 2 hours.

## Design Philosophy

I’ve leveraged the `commander` library as a starting point because the command programming pattern is ideal for a CLI application. All commands are housed within `/lib/command`. To facilitate the addition of new commands by others, I adhered to the convention over configuration principle. Simply creating a new command unit will automatically make it usable without modifying any other code. This functionality is achieved through `/lib/command/index.js`, which autoloads all commands.

## Features Implemented

1. **Dependency Conflict Resolution**: If a different version of a package is already installed, the new package version will be installed in a subdirectory of the package being installed.
2. **Caching**: Files are cached in `~/.jpm/cache`.
3. **Validation**: After download, all packages are checked against their SHA hash to ensure integrity.
4. **Circular Dependency Handling**: Packages are installed recursively. A stack of dependencies is maintained, and any circular dependencies are detected and displayed.

## Running Tests

Tests can be run with:
```
npm test
```