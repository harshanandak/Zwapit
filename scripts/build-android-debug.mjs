import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const androidDir = join(process.cwd(), "android");
const gradleWrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradlePath = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const env = { ...process.env };

if (!existsSync(gradlePath)) {
  console.error("Android project is missing. Run `bunx cap add android` first.");
  process.exit(1);
}

if (process.platform === "win32" && !env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && env.LOCALAPPDATA) {
  const defaultSdk = join(env.LOCALAPPDATA, "Android", "Sdk");
  if (existsSync(defaultSdk)) {
    env.ANDROID_HOME = defaultSdk;
    env.ANDROID_SDK_ROOT = defaultSdk;
  }
}

const result = spawnSync(gradleWrapper, ["assembleDebug", "--no-daemon", "--console=plain"], {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
