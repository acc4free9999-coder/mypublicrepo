# FocusGuard

FocusGuard is a SwiftUI app that uses Apple's Screen Time frameworks to block selected apps and websites with daily usage limits, recurring schedules, all-day rules, and manual focus sessions.

## Requirements

- macOS with Xcode 27.2 or newer (the project uses Swift 6 and an iOS 18 deployment target).
- XcodeGen 2.46 or newer.
- An Apple Developer team for installing on a physical device.
- Apple's Family Controls capability approved for the app and its extensions for distribution. Development signing may also require the capability on the team and device.
- An iPhone running iOS 18 or later for real-device testing. Screen Time blocking cannot be verified in the iOS Simulator.

Install XcodeGen if needed:

```sh
brew install xcodegen
```

## Configure Signing and Capabilities

1. Open `project.yml` and replace the empty `DEVELOPMENT_TEAM` value with your Apple Developer Team ID:

   ```yaml
   DEVELOPMENT_TEAM: "YOUR_TEAM_ID"
   ```

2. Choose a unique bundle ID prefix. The default targets use:
   - App: `com.focusguard.app`
   - Device Activity monitor: `com.focusguard.app.monitor`
   - Shield configuration: `com.focusguard.app.shield-configuration`
   - Shield action: `com.focusguard.app.shield-action`
   - Device Activity report: `com.focusguard.app.report`

   If changing the prefix, update `options.bundleIdPrefix` and the target bundle identifiers in `project.yml` consistently.

3. In the Apple Developer portal, register the App Group `group.com.focusguard.shared`. If you change it, update the App Group identifier in `project.yml` and `Shared/Core/AppGroup.swift`.

4. Enable the **Family Controls** capability for the app and each Screen Time extension in the Developer portal. The project includes the entitlement on the app, monitor, shield configuration, shield action, and report targets. Apple must approve the entitlement for distribution; entitlement availability and approval are controlled by Apple.

5. In Xcode, confirm the `FocusGuard` scheme is selected, set the same Team for every target under **Signing & Capabilities**, and confirm automatic signing is enabled. Xcode should create or download provisioning profiles containing the Family Controls entitlement and App Group. The generated `FocusGuard.xcodeproj` is ignored by Git; make persistent project changes in `project.yml` and regenerate it.

## Generate and Open the Project

From the repository directory:

```sh
xcodegen generate
open FocusGuard.xcodeproj
```

Or generate and build from Terminal:

```sh
xcodegen generate
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project FocusGuard.xcodeproj \
  -scheme FocusGuard \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData \
  build
```

If Xcode is selected as the active developer directory, the `DEVELOPER_DIR` prefix is not needed. If dependency resolution prompts in Xcode, allow Swift Package Manager to resolve the local `FocusGuardKit` package.

## Run on a Real iPhone

1. Connect and trust the iPhone, unlock it, and enable Developer Mode if iOS requests it.
2. Open `FocusGuard.xcodeproj` and select the `FocusGuard` scheme and your connected iPhone as the run destination.
3. In **Signing & Capabilities**, verify the Team, bundle IDs, App Group, and Family Controls entitlement for the app and all extension targets. Resolve any provisioning errors before running.
4. Press **Run** (⌘R). On first launch, proceed through onboarding and grant Screen Time access when iOS presents its system authorization prompt. Notification permission is optional.
5. Create a block list, select apps in Apple's Family Activity picker, and add a usage limit or schedule. Open one of the selected apps to verify that iOS presents the FocusGuard shield when the rule is active.

The first Screen Time authorization can require a network connection and device authentication. Authorization can be denied or restricted by device management or account state. Without approval, the app remains browseable but rules do not block apps. Re-check the app and extension signing after changing entitlements; provisioning profiles must include the same capabilities.

## Tests

Run the cross-platform rule, schedule, usage-limit, and focus-statistics tests on macOS:

```sh
cd FocusGuardKit
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test
```

Build the app integration tests for an iOS destination:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project FocusGuard.xcodeproj \
  -scheme FocusGuard \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData \
  CODE_SIGNING_ALLOWED=NO build-for-testing
```

To execute the integration tests, install an iOS Simulator runtime in Xcode and run the test scheme on a simulator. Screen Time shielding itself requires a physical device and valid authorization, so verify blocking behavior there as well.

## System Constraints

- iOS enforces Screen Time rules and wakes the Device Activity monitor extension; FocusGuard does not rely on a continuously running background process.
- iOS limits how many Device Activity schedules can be monitored concurrently. FocusGuard prioritizes focus sessions and usage limits, then schedules, then all-day rules; rules beyond the system quota are reported in the app.
- Usage data arrives through system threshold events and is approximate in the UI. Screen Time reports are rendered inside Apple's report extension.
- The shield UI is limited to Apple's supported `ShieldConfiguration` elements. It supports color/blur, an icon, title, subtitle, and supported button labels, not arbitrary layouts, navigation, gradients, or background images.
- Schedule times follow the device's current time zone. Daylight-saving changes can affect when local wall-clock schedules occur.
- App names and usage are handled by Apple's privacy-preserving Screen Time APIs and are not uploaded by FocusGuard.
