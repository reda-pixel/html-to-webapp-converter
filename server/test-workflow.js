import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const testDir = path.join(os.tmpdir(), "html-to-webapp-test");

async function run() {
  console.log("=== REAL BUILD WORKFLOW TEST ===");

  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });

  const files = {
    "package.json": JSON.stringify(
      {
        name: "test-webapp",
        version: "1.0.0",
        scripts: {
          build: "node build.js"
        }
      },
      null,
      2
    ),

    "build.js": `
import fs from "fs/promises";

await fs.mkdir("dist", { recursive: true });

await fs.writeFile(
  "dist/index.html",
  \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Real Build Test</title>
</head>
<body>
  <h1>REAL BUILD SUCCESS</h1>
  <p>This file was created by the build process.</p>
</body>
</html>\`
);

console.log("Build completed successfully.");
`
  };

  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(testDir, file);
    await fs.writeFile(filePath, content, "utf8");
  }

  await fs.writeFile(
    path.join(testDir, "package.json"),
    JSON.stringify(
      {
        name: "test-webapp",
        version: "1.0.0",
        type: "module",
        scripts: {
          build: "node build.js"
        }
      },
      null,
      2
    )
  );

  console.log("Project created.");

  try {
    const result = await execFileAsync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build"],
      {
        cwd: testDir,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024
      }
    );

    console.log(result.stdout);

    const output = path.join(testDir, "dist", "index.html");

    try {
      await fs.access(output);
      console.log("================================");
      console.log("REAL BUILD TEST: SUCCESS");
      console.log("Output: dist/index.html");
      console.log("================================");
    } catch {
      console.error("BUILD RAN BUT OUTPUT IS MISSING");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("REAL BUILD TEST FAILED");
    console.error(error.stderr || error.message);
    process.exitCode = 1;
  }
}

run();
