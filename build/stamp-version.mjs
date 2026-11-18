// Writes a release version into the platform build assets.
//
// The Wails build copies build/darwin/Info.plist into the .app bundle and
// compiles build/windows/info.json into the .exe, so tagging a release is only
// honest if those files carry the tag version.
//
// Usage: node build/stamp-version.mjs 0.1.1

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: node build/stamp-version.mjs <major.minor.patch>");
  process.exit(1);
}

const buildDir = dirname(fileURLToPath(import.meta.url));

// One entry per place a version is baked into a build asset. Each pattern must
// match exactly once: if Wails reshapes these files, fail loudly instead of
// shipping a silently mislabelled binary.
const targets = [
  ["config.yml", /(\n\s*version: ")[^"]*(")/],
  ["darwin/Info.plist", /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/],
  ["darwin/Info.plist", /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/],
  ["darwin/Info.dev.plist", /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/],
  ["darwin/Info.dev.plist", /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/],
  ["windows/info.json", /("file_version": ")[^"]*(")/],
  ["windows/info.json", /("ProductVersion": ")[^"]*(")/],
];

const contents = new Map();
for (const [file] of targets) {
  if (!contents.has(file)) contents.set(file, readFileSync(join(buildDir, file), "utf8"));
}

for (const [file, pattern] of targets) {
  const before = contents.get(file);
  const match = pattern.exec(before);
  if (!match) throw new Error(`${file}: ${pattern} matched nothing, build assets changed shape`);
  if (match[1] + version + match[2] === match[0]) continue;
  contents.set(
    file,
    before.slice(0, match.index) + match[1] + version + match[2] + before.slice(match.index + match[0].length),
  );
}

for (const [file, text] of contents) {
  writeFileSync(join(buildDir, file), text);
  console.log(`stamped ${file} → ${version}`);
}
