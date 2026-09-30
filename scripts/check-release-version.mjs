import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const [packageJson, packageLock, tauriJson, cargoToml, cargoLock, notes] = await Promise.all([
  read("package.json"), read("package-lock.json"), read("src-tauri/tauri.conf.json"),
  read("src-tauri/Cargo.toml"), read("src-tauri/Cargo.lock"), read("RELEASE_NOTES.md"),
]);
const version = JSON.parse(packageJson).version;
const locked = JSON.parse(packageLock);
assert.equal(locked.version, version, "npm lockfile version must match");
assert.equal(locked.packages[""].version, version, "npm root package version must match");
assert.equal(JSON.parse(tauriJson).version, version, "Tauri version must match");
assert.equal(cargoToml.match(/^version = "([^"]+)"/m)?.[1], version, "Cargo package version must match");
assert.equal(cargoLock.match(/\[\[package\]\]\r?\nname = "junrei-journal"\r?\nversion = "([^"]+)"/)?.[1], version, "Cargo lockfile version must match");
assert.ok(notes.startsWith(`# 巡礼手账 v${version}`), "Release notes must describe the current version");
const ref = process.env.GITHUB_REF;
if (ref?.startsWith("refs/tags/")) assert.equal(ref, `refs/tags/v${version}`, "Release tag must match the app version");
console.log(`Release version is consistent: v${version}`);
