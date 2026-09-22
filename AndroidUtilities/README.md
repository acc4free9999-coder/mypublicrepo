# Android Utilities

Native Android utility app with controls for:

- Torch light on/off
- Screen brightness
- Media volume
- Notification center
- Control center / Quick Settings

## Notes

- Torch uses the device camera flash and asks for camera permission when first enabled.
- System brightness changes require Android's special "Modify system settings" permission. Without it, the slider still changes this app window brightness.
- Android does not allow normal apps to open notification center or Quick Settings directly. Enable the app's Accessibility Service, then use the buttons in the app.

## Build

From this folder:

```sh
./gradlew assembleDebug
```

APK:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Install:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Open:

```sh
adb shell am start -n com.example.androidutilities/.MainActivity
```
