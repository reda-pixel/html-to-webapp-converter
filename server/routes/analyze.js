```js
import express from "express";

const router = express.Router();

/**
 * POST /api/analyze
 *
 * Accepts:
 * {
 *   html?: string,
 *   files?: {
 *     "package.json": "...",
 *     "src/App.jsx": "...",
 *     ...
 *   }
 * }
 */

router.post("/", (req, res) => {
  try {
    const { html, files } = req.body || {};

    if (!html && (!files || typeof files !== "object")) {
      return res.status(400).json({
        success: false,
        error: "Provide html or files"
      });
    }

    const projectFiles = normalizeFiles(files || {});

    if (html && Object.keys(projectFiles).length === 0) {
      projectFiles["index.html"] = html;
    }

    const analysis = analyzeProject(projectFiles);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error("Analyze error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function normalizeFiles(files) {
  const result = {};

  for (const [filePath, value] of Object.entries(files || {})) {
    if (!filePath || typeof filePath !== "string") continue;

    const normalizedPath = filePath.replace(/\\/g, "/");

    if (typeof value === "string") {
      result[normalizedPath] = value;
    } else if (value && typeof value.content === "string") {
      result[normalizedPath] = value.content;
    }
  }

  return result;
}

function analyzeProject(files) {
  const filePaths = Object.keys(files);

  const packageJson = readPackageJson(files);

  const packageScripts = packageJson?.scripts || {};

  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
    ...(packageJson?.peerDependencies || {})
  };

  const framework = detectFramework(files, packageJson);
  const language = detectLanguage(filePaths);
  const projectType = detectProjectType(
    files,
    packageJson,
    framework
  );

  const buildCommand = detectBuildCommand(
    packageJson,
    framework
  );

  const startCommand = detectStartCommand(
    packageJson,
    framework
  );

  return {
    version: 1,

    project: {
      type: projectType,
      framework: framework.name,
      frameworkVersion: framework.version || null,
      language,
      packageManager: detectPackageManager(filePaths),
      entryPoints: detectEntryPoints(
        filePaths,
        framework
      ),
      buildCommand,
      startCommand
    },

    framework,

    package: packageJson
      ? {
          name: packageJson.name || null,
          version: packageJson.version || null,
          private: packageJson.private === true,
          scripts: packageScripts,
          dependencies,
          dependencyCount: Object.keys(dependencies).length
        }
      : null,

    files: {
      count: filePaths.length,
      paths: filePaths,
      byExtension: countExtensions(filePaths),
      sourceFiles: filePaths.filter(isSourceFile),
      assetFiles: filePaths.filter(isAssetFile)
    },

    html: analyzeHTMLFiles(files),

    source: analyzeSourceFiles(files),

    requirements: {
      needsInstall: Boolean(packageJson),
      needsBuild: Boolean(buildCommand),
      isStatic: projectType === "static-html",
      isNodeProject: Boolean(packageJson),
      hasTypeScript: filePaths.some(
        p => /\.(ts|tsx)$/i.test(p)
      ),
      hasReact: Boolean(dependencies.react),
      hasNext: Boolean(dependencies.next),
      hasVite: Boolean(dependencies.vite)
    },

    build: {
      command: buildCommand,
      outputDirectory: detectOutputDirectory(
        framework,
        packageJson,
        files
      ),
      productionReady: Boolean(buildCommand)
    }
  };
}

function readPackageJson(files) {
  const packagePath = Object.keys(files).find(
    p => p.toLowerCase() === "package.json"
  );

  if (!packagePath) return null;

  try {
    return JSON.parse(files[packagePath]);
  } catch {
    return {
      __invalid: true,
      __error: "Invalid package.json"
    };
  }
}

function detectFramework(files, pkg) {
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.peerDependencies || {})
  };

  const paths = Object.keys(files);

  if (
    deps.next ||
    paths.some(p => p.includes("next.config."))
  ) {
    return {
      name: "next",
      type: "framework",
      version: deps.next || null
    };
  }

  if (
    deps.react &&
    (
      deps.vite ||
      paths.some(p => /vite\.config\./i.test(p))
    )
  ) {
    return {
      name: "react-vite",
      type: "framework",
      version: deps.react || null
    };
  }

  if (deps.react) {
    return {
      name: "react",
      type: "library",
      version: deps.react || null
    };
  }

  if (deps.nuxt) {
    return {
      name: "nuxt",
      type: "framework",
      version: deps.nuxt
    };
  }

  if (deps.vue) {
    return {
      name: "vue",
      type: "framework",
      version: deps.vue
    };
  }

  if (deps["@sveltejs/kit"]) {
    return {
      name: "sveltekit",
      type: "framework",
      version: deps["@sveltejs/kit"]
    };
  }

  if (deps.svelte) {
    return {
      name: "svelte",
      type: "framework",
      version: deps.svelte
    };
  }

  if (deps["@angular/core"]) {
    return {
      name: "angular",
      type: "framework",
      version: deps["@angular/core"]
    };
  }

  if (
    deps.vite ||
    paths.some(p => /vite\.config\./i.test(p))
  ) {
    return {
      name: "vite",
      type: "build-tool",
      version: deps.vite || null
    };
  }

  if (
    paths.some(p => /\.(tsx|jsx)$/i.test(p)) &&
    !pkg
  ) {
    return {
      name: "react-like",
      type: "detected",
      version: null
    };
  }

  if (
    paths.some(p => /\.(ts|tsx)$/i.test(p))
  ) {
    return {
      name: "typescript",
      type: "language",
      version: deps.typescript || null
    };
  }

  if (
    paths.some(p => /\.html?$/i.test(p))
  ) {
    return {
      name: "html",
      type: "static",
      version: null
    };
  }

  return {
    name: "unknown",
    type: "unknown",
    version: null
  };
}

function detectLanguage(paths) {
  const counts = {};

  const languageMap = {
    ".js": "JavaScript",
    ".jsx": "JavaScript/JSX",
    ".ts": "TypeScript",
    ".tsx": "TypeScript/TSX",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".json": "JSON"
  };

  for (const file of paths) {
    const ext = getExtension(file);
    const language = languageMap[ext];

    if (language) {
      counts[language] =
        (counts[language] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count
    }));
}

function detectProjectType(files, pkg, framework) {
  if (pkg) {
    if (framework.name === "next") {
      return "next-app";
    }

    if (framework.name === "react-vite") {
      return "react-vite-app";
    }

    if (framework.name === "react") {
      return "react-app";
    }

    if (framework.name === "vue") {
      return "vue-app";
    }

    if (framework.name === "nuxt") {
      return "nuxt-app";
    }

    if (framework.name === "svelte") {
      return "svelte-app";
    }

    if (framework.name === "sveltekit") {
      return "sveltekit-app";
    }

    if (framework.name === "angular") {
      return "angular-app";
    }

    if (framework.name === "vite") {
      return "vite-app";
    }

    return "node-project";
  }

  if (
    Object.keys(files).some(
      p => /\.html?$/i.test(p)
    )
  ) {
    return "static-html";
  }

  return "unknown";
}

function detectPackageManager(paths) {
  if (paths.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (paths.includes("yarn.lock")) {
    return "yarn";
  }

  if (
    paths.includes("bun.lockb") ||
    paths.includes("bun.lock")
  ) {
    return "bun";
  }

  return "npm";
}

function detectBuildCommand(pkg, framework) {
  if (!pkg || !pkg.scripts) {
    return null;
  }

  if (typeof pkg.scripts.build === "string") {
    return "npm run build";
  }

  if (
    framework.name === "next" ||
    framework.name === "vite" ||
    framework.name === "react-vite"
  ) {
    return "npm run build";
  }

  return null;
}

function detectStartCommand(pkg, framework) {
  if (!pkg || !pkg.scripts) {
    return null;
  }

  if (pkg.scripts.start) {
    return "npm start";
  }

  if (framework.name === "next") {
    return "npm start";
  }

  if (pkg.scripts.dev) {
    return "npm run dev";
  }

  return null;
}

function detectEntryPoints(paths, framework) {
  const candidates = [];

  const preferred = [
    "index.html",
    "src/main.jsx",
    "src/main.tsx",
    "src/main.js",
    "src/main.ts",
    "src/index.jsx",
    "src/index.tsx",
    "src/index.js",
    "src/index.ts",
    "pages/index.js",
    "pages/index.tsx",
    "app/page.tsx"
  ];

  for (const file of preferred) {
    if (paths.includes(file)) {
      candidates.push(file);
    }
  }

  if (framework.name === "next") {
    for (const file of paths) {
      if (
        /^(app|pages)\/.+\.(js|jsx|ts|tsx)$/i.test(file)
      ) {
        candidates.push(file);
      }
    }
  }

  return [...new Set(candidates)];
}

function detectOutputDirectory(
  framework,
  pkg,
  files
) {
  if (framework.name === "next") {
    return ".next";
  }

  if (
    framework.name === "vite" ||
    framework.name === "react-vite"
  ) {
    return "dist";
  }

  if (pkg?.scripts?.build) {
    return "dist";
  }

  if (
    Object.keys(files).some(
      p => p === "index.html"
    )
  ) {
    return ".";
  }

  return null;
}

function analyzeHTMLFiles(files) {
  const result = [];

  for (const [filePath, content] of Object.entries(files)) {
    if (!/\.html?$/i.test(filePath)) {
      continue;
    }

    result.push({
      path: filePath,
      ...analyzeHTML(content)
    });
  }

  return result;
}

function analyzeHTML(html) {
  const title =
    (
      html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
      ) || []
    )[1] || null;

  const scripts =
    html.match(/<script[^>]*>/gi) || [];

  const styles =
    html.match(/<style[^>]*>/gi) || [];

  const links =
    html.match(/<link[^>]*>/gi) || [];

  const elements = {};

  const regex =
    /<([a-zA-Z][a-zA-Z0-9-]*)\b/g;

  let match;

  while ((match = regex.exec(html))) {
    const tag = match[1].toLowerCase();

    if (
      ["script", "style", "meta", "link"].includes(tag)
    ) {
      continue;
    }

    elements[tag] =
      (elements[tag] || 0) + 1;
  }

  return {
    title,
    hasDoctype: /<!doctype\s+html/i.test(html),
    hasHead: /<head[\s>]/i.test(html),
    hasBody: /<body[\s>]/i.test(html),
    language:
      (
        html.match(
          /<html[^>]+lang=["']([^"']+)/i
        ) || []
      )[1] || null,
    scriptCount: scripts.length,
    styleCount: styles.length,
    linkCount: links.length,
    elements
  };
}

function analyzeSourceFiles(files) {
  const result = [];

  for (const [filePath, content] of Object.entries(files)) {
    if (!isSourceFile(filePath)) {
      continue;
    }

    result.push({
      path: filePath,
      extension: getExtension(filePath),
      size: Buffer.byteLength(content, "utf8"),
      lines: content.split(/\r?\n/).length
    });
  }

  return result;
}

function countExtensions(paths) {
  const result = {};

  for (const filePath of paths) {
    const ext =
      getExtension(filePath) ||
      "[no extension]";

    result[ext] =
      (result[ext] || 0) + 1;
  }

  return result;
}

function getExtension(filePath) {
  const match =
    filePath
      .toLowerCase()
      .match(/(\.[a-z0-9]+)$/);

  return match ? match[1] : "";
}

function isSourceFile(filePath) {
  return /\.(js|jsx|ts|tsx|vue|svelte|html|htm|css|scss|sass|less)$/i.test(
    filePath
  );
}

function isAssetFile(filePath) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|mp4|webm|mp3|wav|json)$/i.test(
    filePath
  );
}

export default router;
```
