#!/bin/zsh
set -e
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.example.topedgeblocker/.MainActivity
