/**
 * Discovery step — calibrates the harness against the target workspace.
 *
 *  - Existing project: scans signature files to auto-detect the tech stack and
 *    dynamically maps executable commands (test/build/lint/format/run).
 *  - New project: when no signature is present, switches to "New Project Mode"
 *    so the Planner can invent the layout from scratch.
 *  - Git safety lock: if the repo is dirty, an isolated scratch branch is cut
 *    before any modification is permitted.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { CommandPlan, GitInfo, ProjectProfile, SupportedLanguage } from "../core/types.ts";
import type { SystemToolbox } from "../tools/toolbox.ts";

interface Detector {
  readonly id: string;
  readonly signatures: readonly string[];
  readonly language: SupportedLanguage;
  readonly packageManager: string | null;
  readonly commands: CommandPlan;
}

const NO_COMMANDS: CommandPlan = {
  install: null,
  build: null,
  test: null,
  lint: null,
  format: null,
  run: null,
};

function commands(partial: Partial<CommandPlan>): CommandPlan {
  return { ...NO_COMMANDS, ...partial };
}

/** Priority-ordered detectors. First match wins. */
const DETECTORS: readonly Detector[] = [
  {
    id: "node-package-json",
    signatures: ["package.json"],
    language: "typescript",
    packageManager: "npm",
    commands: commands({
      install: "npm install",
      build: "npm run build",
      test: "npm test",
      lint: "npm run lint",
      format: "npm run format",
      run: "npm start",
    }),
  },
  {
    id: "rust-cargo",
    signatures: ["Cargo.toml"],
    language: "rust",
    packageManager: "cargo",
    commands: commands({
      install: "cargo fetch",
      build: "cargo build",
      test: "cargo test",
      lint: "cargo clippy --all-targets -- -D warnings",
      format: "cargo fmt",
      run: "cargo run",
    }),
  },
  {
    id: "go-module",
    signatures: ["go.mod"],
    language: "go",
    packageManager: "go",
    commands: commands({
      install: "go mod download",
      build: "go build ./...",
      test: "go test ./...",
      lint: "go vet ./...",
      format: "gofmt -w .",
      run: "go run .",
    }),
  },
  {
    id: "python-poetry",
    signatures: ["poetry.lock", "pyproject.toml"],
    language: "python",
    packageManager: "poetry",
    commands: commands({
      install: "poetry install",
      build: "poetry build",
      test: "poetry run pytest",
      lint: "poetry run ruff check .",
      format: "poetry run black .",
      run: "poetry run python -m app",
    }),
  },
  {
    id: "python-requirements",
    signatures: ["requirements.txt", "setup.py", "Pipfile"],
    language: "python",
    packageManager: "pip",
    commands: commands({
      install: "pip install -r requirements.txt",
      build: null,
      test: "pytest",
      lint: "ruff check .",
      format: "black .",
      run: "python -m app",
    }),
  },
  {
    id: "java-maven",
    signatures: ["pom.xml"],
    language: "java",
    packageManager: "maven",
    commands: commands({
      install: "mvn -q dependency:resolve",
      build: "mvn -q -DskipTests package",
      test: "mvn -q test",
      lint: "mvn -q checkstyle:check",
      format: "mvn -q spotless:apply",
      run: "mvn -q exec:java",
    }),
  },
  {
    id: "java-gradle",
    signatures: ["build.gradle", "build.gradle.kts", "settings.gradle"],
    language: "java",
    packageManager: "gradle",
    commands: commands({
      install: "gradle dependencies",
      build: "gradle build -x test",
      test: "gradle test",
      lint: "gradle check",
      format: "gradle spotlessApply",
      run: "gradle run",
    }),
  },
  {
    id: "ruby-bundler",
    signatures: ["Gemfile"],
    language: "ruby",
    packageManager: "bundler",
    commands: commands({
      install: "bundle install",
      build: null,
      test: "bundle exec rspec",
      lint: "bundle exec rubocop",
      format: "bundle exec rubocop -A",
      run: "bundle exec ruby app.rb",
    }),
  },
  {
    id: "php-composer",
    signatures: ["composer.json"],
    language: "php",
    packageManager: "composer",
    commands: commands({
      install: "composer install",
      build: null,
      test: "vendor/bin/phpunit",
      lint: "vendor/bin/phpcs",
      format: "vendor/bin/phpcbf",
      run: "php -S localhost:8000",
    }),
  },
  {
    id: "dotnet",
    signatures: ["*.csproj", "*.sln"],
    language: "csharp",
    packageManager: "dotnet",
    commands: commands({
      install: "dotnet restore",
      build: "dotnet build -c Release",
      test: "dotnet test",
      lint: "dotnet format --verify-no-changes",
      format: "dotnet format",
      run: "dotnet run",
    }),
  },
  {
    id: "cpp-cmake",
    signatures: ["CMakeLists.txt", "Makefile"],
    language: "cpp",
    packageManager: "cmake",
    commands: commands({
      install: null,
      build: "cmake --build build",
      test: "ctest --test-dir build",
      lint: "clang-tidy",
      format: "clang-format -i",
      run: "./build/app",
    }),
  },
];

const EXTENSION_LANGUAGE: Readonly<Record<string, SupportedLanguage>> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
};

async function rootEntries(root: string): Promise<string[]> {
  try {
    return await fs.readdir(root);
  } catch {
    return [];
  }
}

function matchesSignature(name: string, signature: string): boolean {
  if (signature.startsWith("*.")) {
    return name.endsWith(signature.slice(1));
  }
  return name === signature;
}

function detectDominantLanguage(files: readonly string[]): SupportedLanguage {
  const tally = new Map<SupportedLanguage, number>();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const lang = EXTENSION_LANGUAGE[ext];
    if (lang) tally.set(lang, (tally.get(lang) ?? 0) + 1);
  }
  let best: SupportedLanguage = "unknown";
  let bestCount = 0;
  for (const [lang, count] of tally) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

export interface DiscoveryResult {
  readonly profile: ProjectProfile;
  readonly presentSignatures: readonly string[];
  readonly allFiles: readonly string[];
}

export async function discoverProfile(toolbox: SystemToolbox): Promise<DiscoveryResult> {
  const entries = await rootEntries(toolbox.root);
  const notes: string[] = [];

  const presentSignatures: string[] = [];
  let chosen: Detector | null = null;
  for (const detector of DETECTORS) {
    const hits = detector.signatures.filter((sig) => entries.some((name) => matchesSignature(name, sig)));
    if (hits.length > 0) {
      presentSignatures.push(...hits);
      if (!chosen) {
        chosen = detector;
        notes.push(`Matched detector '${detector.id}' via ${hits.join(", ")}`);
      }
    }
  }

  const allFiles = await toolbox.listFiles(".");
  const hasSource = allFiles.length > 0;

  if (!chosen && !hasSource) {
    notes.push("No signature files and no source files found -> New Project Mode");
    return {
      profile: {
        mode: "new",
        language: "unknown",
        packageManager: null,
        signatureFiles: [],
        commands: NO_COMMANDS,
        isGitRepo: false,
        notes,
      },
      presentSignatures,
      allFiles,
    };
  }

  if (!chosen) {
    const language = detectDominantLanguage(allFiles);
    notes.push(`No known signature file; inferred language '${language}' from file extensions`);
    return {
      profile: {
        mode: "existing",
        language,
        packageManager: null,
        signatureFiles: [],
        commands: NO_COMMANDS,
        isGitRepo: false,
        notes,
      },
      presentSignatures,
      allFiles,
    };
  }

  // Refine Node flavor: pnpm/yarn lockfiles and TS vs JS.
  let packageManager = chosen.packageManager;
  let language = chosen.language;
  if (chosen.id === "node-package-json") {
    if (entries.includes("pnpm-lock.yaml")) {
      packageManager = "pnpm";
      notes.push("pnpm-lock.yaml present -> package manager pnpm");
    } else if (entries.includes("yarn.lock")) {
      packageManager = "yarn";
      notes.push("yarn.lock present -> package manager yarn");
    }
    const usesTs = entries.includes("tsconfig.json") || allFiles.some((f) => /\.tsx?$/.test(f));
    language = usesTs ? "typescript" : "javascript";
    notes.push(`Node project detected -> language ${language}`);
  }

  const cmd =
    packageManager === "pnpm"
      ? commands({
          install: "pnpm install",
          build: "pnpm run build",
          test: "pnpm test",
          lint: "pnpm run lint",
          format: "pnpm run format",
          run: "pnpm start",
        })
      : packageManager === "yarn"
        ? commands({
            install: "yarn install",
            build: "yarn build",
            test: "yarn test",
            lint: "yarn lint",
            format: "yarn format",
            run: "yarn start",
          })
        : chosen.commands;

  return {
    profile: {
      mode: "existing",
      language,
      packageManager,
      signatureFiles: presentSignatures,
      commands: cmd,
      isGitRepo: false,
      notes,
    },
    presentSignatures,
    allFiles,
  };
}

/** Established identity used for any harness-authored commits. */
const HARNESS_GIT_IDENTITY = {
  name: "opencode-zen-harness",
  email: "harness@opencode-zen.local",
};

export async function gitSafetyLock(toolbox: SystemToolbox, runId: string): Promise<GitInfo> {
  const status = await toolbox.gitStatus();
  if (!status.isRepo) {
    return { isRepo: false, branch: null, dirtyBefore: false, scratchBranch: null, createdScratch: false, baseCommit: null };
  }

  const baseCommit = await toolbox.currentCommit();

  if (!status.dirty) {
    return {
      isRepo: true,
      branch: status.branch,
      dirtyBefore: false,
      scratchBranch: null,
      createdScratch: false,
      baseCommit,
    };
  }

  const short = runId.replace(/-/g, "").slice(0, 8);
  const scratchBranch = `opencode-agent/patch-${short}`;
  const create = await toolbox.git(`checkout -b ${scratchBranch}`);
  const created = create.code === 0;
  await toolbox.git(`config user.name "${HARNESS_GIT_IDENTITY.name}"`);
  await toolbox.git(`config user.email "${HARNESS_GIT_IDENTITY.email}"`);

  return {
    isRepo: true,
    branch: status.branch,
    dirtyBefore: true,
    scratchBranch: created ? scratchBranch : null,
    createdScratch: created,
    baseCommit,
  };
}

export async function ensureGitIdentity(toolbox: SystemToolbox): Promise<void> {
  await toolbox.git(`config user.name "${HARNESS_GIT_IDENTITY.name}"`);
  await toolbox.git(`config user.email "${HARNESS_GIT_IDENTITY.email}"`);
}

export interface FullDiscovery {
  readonly profile: ProjectProfile;
  readonly git: GitInfo;
}

export async function discover(toolbox: SystemToolbox, runId: string): Promise<FullDiscovery> {
  const { profile } = await discoverProfile(toolbox);
  const git = await gitSafetyLock(toolbox, runId);
  const mergedProfile: ProjectProfile = { ...profile, isGitRepo: git.isRepo };
  return { profile: mergedProfile, git };
}
