import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

if (process.platform !== "darwin") {
  console.error("iOS simulator builds require macOS with Xcode.");
  process.exit(1);
}

const workspace = join(process.cwd(), "ios", "App", "App.xcworkspace");

if (!existsSync(workspace)) {
  console.error("iOS project is missing. Run `bunx cap add ios` first.");
  process.exit(1);
}

const result = spawnSync(
  "xcodebuild",
  [
    "-workspace",
    workspace,
    "-scheme",
    "App",
    "-configuration",
    "Debug",
    "-sdk",
    "iphonesimulator",
    "-derivedDataPath",
    join(process.cwd(), "ios", "build"),
    "CODE_SIGNING_ALLOWED=NO",
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
