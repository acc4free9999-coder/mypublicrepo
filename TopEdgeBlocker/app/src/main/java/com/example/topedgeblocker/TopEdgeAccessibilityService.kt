package com.example.topedgeblocker

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager

class TopEdgeAccessibilityService : AccessibilityService() {

    private val overlays = mutableListOf<View>()
    private var windowManager: WindowManager? = null

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == MainActivity.ACTION_REFRESH) {
                refreshOverlay()
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val filter = IntentFilter(MainActivity.ACTION_REFRESH)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(receiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(receiver, filter)
        }

        refreshOverlay()
    }

    private fun refreshOverlay() {
        removeOverlay()

        val prefs = getSharedPreferences("settings", MODE_PRIVATE)
        val enabled = prefs.getBoolean("enabled", true)
        if (!enabled) return

        val mm = prefs.getFloat("height_mm", 5f).coerceIn(3f, 20f)
        val storedEdges = prefs.getStringSet("edges", null)
        val edges = if (storedEdges != null) {
            storedEdges.filter {
                it == MainActivity.EDGE_TOP ||
                    it == MainActivity.EDGE_LEFT ||
                    it == MainActivity.EDGE_RIGHT ||
                    it == MainActivity.EDGE_BOTTOM
            }.toSet()
        } else {
            setOf(prefs.getString("edge", MainActivity.EDGE_TOP) ?: MainActivity.EDGE_TOP)
        }
        val density = resources.displayMetrics.xdpi
        val thicknessPx = (mm * density / 25.4f).toInt().coerceAtLeast(1)

        edges.forEach { edge ->
            val view = View(this).apply {
                // Fully transparent: no visual obstruction.
                setBackgroundColor(Color.TRANSPARENT)

                // Returning true consumes touch events inside this strip.
                setOnTouchListener { _, event ->
                    event.actionMasked != MotionEvent.ACTION_OUTSIDE
                }

                // Prevent the view itself from drawing anything visible.
                alpha = 0.01f
            }

            val params = WindowManager.LayoutParams(
                when (edge) {
                    MainActivity.EDGE_LEFT, MainActivity.EDGE_RIGHT -> thicknessPx
                    else -> WindowManager.LayoutParams.MATCH_PARENT
                },
                when (edge) {
                    MainActivity.EDGE_LEFT, MainActivity.EDGE_RIGHT -> WindowManager.LayoutParams.MATCH_PARENT
                    else -> thicknessPx
                },
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = when (edge) {
                    MainActivity.EDGE_LEFT -> Gravity.TOP or Gravity.START
                    MainActivity.EDGE_RIGHT -> Gravity.TOP or Gravity.END
                    MainActivity.EDGE_BOTTOM -> Gravity.BOTTOM or Gravity.START
                    else -> Gravity.TOP or Gravity.START
                }
            }

            try {
                windowManager?.addView(view, params)
                overlays.add(view)
            } catch (_: WindowManager.BadTokenException) {
                // Ignore failed edge and continue with remaining selected edges.
            } catch (_: IllegalArgumentException) {
                // Ignore failed edge and continue with remaining selected edges.
            } catch (_: IllegalStateException) {
                // Ignore failed edge and continue with remaining selected edges.
            } catch (_: SecurityException) {
                // Ignore failed edge and continue with remaining selected edges.
            }
        }
    }

    private fun removeOverlay() {
        overlays.forEach { overlay ->
            try {
                windowManager?.removeView(overlay)
            } catch (_: IllegalArgumentException) {
            } catch (_: IllegalStateException) {
            }
        }
        overlays.clear()
    }

    override fun onAccessibilityEvent(event: android.view.accessibility.AccessibilityEvent?) {
        // No accessibility data is read or acted upon.
    }

    override fun onInterrupt() {
        // Nothing to interrupt.
    }

    override fun onDestroy() {
        removeOverlay()
        try {
            unregisterReceiver(receiver)
        } catch (_: Exception) {
        }
        super.onDestroy()
    }
}
