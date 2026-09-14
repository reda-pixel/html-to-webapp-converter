```js
import express from "express";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const router = express.Router();
const execFileAsync = promisify(execFile);

router.post("/", async (req, res) => {
  let projectDir = null;

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        error: "GitHub repository URL is required"
      });
    }

    const match = url.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        error: "Invalid GitHub repository URL"
      });
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");

    projectDir = path.join(
      os.tmpdir(),
      `github-project-${crypto.randomUUID()}`
    );

    console.log(`Cloning ${owner}/${repo}...`);

    await execFileAsync(
      "git",
      [
        "clone",
        "--depth",
        "1",
        `https://github.com/${owner}/${repo}.git`,
        projectDir
      ],
      {
        timeout: 10 * 60 * 1000,
        maxBuffer: 20 * 1024 * 1024
      }
    );

    const files = {};

    await collectFiles(projectDir, projectDir, files);

    console.log(
      `GitHub import complete: ${Object.keys(files).length} files`
    );

    // Analyze
    let analysis = null;

    try {
      const packageJsonPath = path.join(projectDir, "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf8")
      );

      analysis = detectProject(packageJson, files);
    } catch {
      analysis = detectProject(null, files);
    }

    // Build
    let build = null;

    if (analysis.hasPackageJson) {
      build = await buildProject(
        projectDir,
        analysis.packageManager
      );
    }

    res.json({
      success: true,
      data: {
        owner,
        repo,
        fileCount: Object.keys(files).length,
        analysis,
        build,
        files
      }
    });

  } catch (error) {
    console.error("GitHub import/build error:", error);

    res.status(500).json({
      success: false,
      error: error.stderr || error.message
    });
  }
});


function detectProject(packageJson, files) {
  const fileNames = Object.keys(files);

  if (!packageJson) {
    return {
      hasPackageJson: false,
      framework: "HTML",
      packageManager: "npm",
      buildRequired: false
    };
  }

  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };

  let framework = "JavaScript";

  if (dependencies.next) {
    framework = "Next.js";
  } else if (dependencies.react) {
    framework = "React";
  } else if (dependencies.vue) {
    framework = "Vue";
  } else if (dependencies.svelte) {
    framework = "Svelte";
  } else if (dependencies["@angular/core"]) {
    framework = "Angular";
  } else if (dependencies.vite) {
    framework = "Vite";
  }

  let packageManager = "npm";

  if (fileNames.includes("yarn.lock")) {
    packageManager = "yarn";
  } else if (fileNames.includes("pnpm-lock.yaml")) {
    packageManager = "pnpm";
  } else if (fileNames.includes("bun.lockb") || fileNames.includes("bun.lock")) {
    packageManager = "bun";
  }

  return {
    hasPackageJson: true,
    framework,
    packageManager,
    buildRequired: Boolean(packageJson.scripts?.build),
    scripts: packageJson.scripts || {},
    dependencies
  };
}


async function buildProject(projectDir, packageManager) {
  const result = {
    installed: false,
    built: false,
    installCommand: null,
    buildCommand: null,
    outputDirectory: null
  };

  let installCommand;

  if (packageManager === "yarn") {
    installCommand = ["yarn", ["install", "--ignore-scripts"]];
  } else if (packageManager === "pnpm") {
    installCommand = ["pnpm", ["install", "--ignore-scripts"]];
  } else if (packageManager === "bun") {
    installCommand = ["bun", ["install", "--ignore-scripts"]];
  } else {
    installCommand = [
      "npm",
      ["install", "--no-audit", "--no-fund", "--ignore-scripts"]
    ];
  }

  result.installCommand = `${installCommand[0]} ${installCommand[1].join(" ")}`;

  await execFileAsync(
    installCommand[0],
    installCommand[1],
    {
      cwd: projectDir,
      timeout: 10 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  result.installed = true;

  const packageJson = JSON.parse(
    await fs.readFile(
      path.join(projectDir, "package.json"),
      "utf8"
    )
  );

  if (!packageJson.scripts?.build) {
    return result;
  }

  result.buildCommand = `${packageManager} run build`;

  await execFileAsync(
    packageManager,
    ["run", "build"],
    {
      cwd: projectDir,
      timeout: 10 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  result.built = true;

  const outputCandidates = [
    ".next",
    "dist",
    "build",
    "out"
  ];

  for (const directory of outputCandidates) {
    try {
      await fs.access(
        path.join(projectDir, directory)
      );

      result.outputDirectory = directory;
      break;
    } catch {
      // Continue searching
    }
  }

  return result;
}


async function collectFiles(root, current, result) {
  const entries = await fs.readdir(current, {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist"
    ) {
      continue;
    }

    const fullPath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(root, fullPath, result);
      continue;
    }

    const relativePath = path
      .relative(root, fullPath)
      .replace(/\\/g, "/");

    try {
      const content = await fs.readFile(
        fullPath,
        "utf8"
      );

      result[relativePath] = content;
    } catch {
      // Ignore binary files for now.
    }
  }
}

export default router;
```
