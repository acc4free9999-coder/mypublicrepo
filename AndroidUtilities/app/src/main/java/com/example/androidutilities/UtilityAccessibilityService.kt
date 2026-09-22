package com.example.androidutilities

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class UtilityAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        activeService = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        if (activeService === this) {
            activeService = null
        }
        super.onDestroy()
    }

    fun showNotificationCenter(): Boolean {
        return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
    }

    fun showControlCenter(): Boolean {
        return performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
    }

    companion object {
        @Volatile
        var activeService: UtilityAccessibilityService? = null
            private set
    }
}
