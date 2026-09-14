
import express from "express";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const router = express.Router();
const execFileAsync = promisify(execFile);

const MAX_FILES = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

router.post("/", async (req, res) => {
  let projectDir = null;

  try {
    const { files, packageManager = "npm" } = req.body || {};

    if (!files || typeof files !== "object" || !Object.keys(files).length) {
      return res.status(400).json({
        success: false,
        error: "Project files are required"
      });
    }

    const fileEntries = Object.entries(files);

    if (fileEntries.length > MAX_FILES) {
      return res.status(400).json({
        success: false,
        error: `Too many files. Maximum is ${MAX_FILES}`
      });
    }

    projectDir = path.join(
      os.tmpdir(),
      `webapp-build-${crypto.randomUUID()}`
    );

    await fs.mkdir(projectDir, { recursive: true });

    for (const [relativePath, content] of fileEntries) {
      if (typeof content !== "string") continue;

      const safePath = path.normalize(relativePath);

      if (
        safePath.startsWith("..") ||
        path.isAbsolute(safePath)
      ) {
        continue;
      }

      if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${relativePath}`);
      }

      const fullPath = path.join(projectDir, safePath);

      await fs.mkdir(path.dirname(fullPath), {
        recursive: true
      });

      await fs.writeFile(fullPath, content, "utf8");
    }

    const packageJsonPath = path.join(projectDir, "package.json");

    let packageJson = null;

    try {
      packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf8")
      );
    } catch {
      packageJson = null;
    }

    let installResult = null;
    let buildResult = null;

    if (packageJson) {
      const manager =
        packageManager === "yarn"
          ? "yarn"
          : packageManager === "pnpm"
          ? "pnpm"
          : packageManager === "bun"
          ? "bun"
          : "npm";

      const installCommand =
        manager === "npm"
          ? "npm"
          : manager;

      const installArgs =
        manager === "npm"
          ? ["install", "--no-audit", "--no-fund"]
          : ["install"];

      installResult = await runCommand(
        installCommand,
        installArgs,
        projectDir
      );

      if (packageJson.scripts?.build) {
        buildResult = await runCommand(
          manager === "npm" ? "npm" : manager,
          manager === "npm"
            ? ["run", "build"]
            : ["run", "build"],
          projectDir
        );
      }
    }

    const outputDirectory = detectOutputDirectory(
      projectDir,
      packageJson
    );

    const outputExists = outputDirectory
      ? await exists(outputDirectory)
      : false;

    res.json({
      success: true,
      data: {
        projectDirectory: projectDir,
        installed: Boolean(installResult),
        built: Boolean(buildResult),
        buildCommand: packageJson?.scripts?.build
          ? "npm run build"
          : null,
        outputDirectory: outputDirectory
          ? path.relative(projectDir, outputDirectory)
          : null,
        outputExists,
        install: installResult,
        build: buildResult
      }
    });
  } catch (error) {
    console.error("Build error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function runCommand(command, args, cwd) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      timeout: 10 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true
    });

    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${
        error.stderr || error.stdout || error.message
      }`
    );
  }
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function detectOutputDirectory(projectDir, packageJson) {
  if (!packageJson) {
    return path.join(projectDir);
  }

  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };

  if (dependencies.next) {
    return path.join(projectDir, ".next");
  }

  if (dependencies.vite) {
    return path.join(projectDir, "dist");
  }

  return path.join(projectDir, "dist");
}

export default router;
