# Top Edge Blocker

Small Android app for a Samsung phone with accidental/ghost touches near the top edge.

## What it does

It uses an AccessibilityService with a `TYPE_ACCESSIBILITY_OVERLAY` window to create an invisible, touch-consuming strip at the selected screen edge.

Default edge: top.

Available edge selections: top / left / right.

Default thickness: 5 mm.

Options: 5 / 7 / 10 mm.

It does not disable SystemUI and does not require root.

## Important

Android treats accessibility services as powerful system features. This app does not inspect window content, read notifications, or automate other apps. It only creates the top-edge touch blocker.

If the strip does not prevent the Quick Panel from opening on your exact One UI build, the limitation is at Samsung/system gesture handling level. Do not use SystemUI-disabling ADB commands as a workaround.

## Build on macOS

Install Android Studio once, or make sure the Android SDK, JDK 17, and command-line build tools are available.

From the project root:

    ./gradlew assembleDebug

APK:

    app/build/outputs/apk/debug/app-debug.apk

Install:

    adb install -r app/build/outputs/apk/debug/app-debug.apk

Open:

    adb shell am start -n com.example.topedgeblocker/.MainActivity

Then:
1. Open Accessibility Settings.
2. Enable "Top Edge Blocker".
3. Return to the app.
4. Choose 5 mm and Start blocker.
5. Test the top edge.
6. If needed, try 7 mm then 10 mm.

To uninstall:

    adb uninstall com.example.topedgeblocker
