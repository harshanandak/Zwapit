# Native App Test Builds

Zwapit uses Capacitor to package the built Astro app into Android and iOS
test builds.

## Platforms

- Android project: `android/`
- iOS project: `ios/`
- Web assets source: `dist/`, configured by `webDir` in `capacitor.config.ts`

## Local Commands

```powershell
bun install
bun run cap:sync
bun run android:test:debug
bun run android:build:debug
```

The Android debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For iOS simulator builds, use macOS with Xcode and CocoaPods:

```bash
bun install
bun run ios:build:sim
```

The iOS simulator app is created under:

```text
ios/build/Build/Products/Debug-iphonesimulator/App.app
```

## CI Artifacts

`.github/workflows/native-builds.yml` runs on pull requests and manual dispatch.
It uploads:

- `zwapit-android-debug-apk`
- `zwapit-ios-simulator-app`

The Android job also runs `testDebugUnitTest` before assembling the debug APK.

## Environment Notes

Android builds need an Android SDK and JDK. The CI job installs Temurin 21 and
uses the generated Gradle wrapper.

iOS builds require macOS with Xcode. On Windows, `cap sync ios` can copy web
assets, but CocoaPods and `xcodebuild` are not available for a real simulator
build.
