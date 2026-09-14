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

    await execFileAsync(
      "git",
      ["clone", "--depth", "1", `https://github.com/${owner}/${repo}.git`, projectDir],
      {
        timeout: 10 * 60 * 1000,
        maxBuffer: 20 * 1024 * 1024
      }
    );

    const files = {};

    await collectFiles(projectDir, projectDir, files);

    res.json({
      success: true,
      data: {
        owner,
        repo,
        fileCount: Object.keys(files).length,
        files
      }
    });

  } catch (error) {
    console.error("GitHub import error:", error);

    res.status(500).json({
      success: false,
      error: error.stderr || error.message
    });
  }
});

async function collectFiles(root, current, result) {
  const entries = await fs.readdir(current, {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules"
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
      const content = await fs.readFile(fullPath, "utf8");
      result[relativePath] = content;
    } catch {
      // Ignore binary files for now.
    }
  }
}

export default router;
