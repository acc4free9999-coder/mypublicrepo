package com.example.topedgeblocker

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : android.app.Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val title = TextView(this).apply {
            text = "Top Edge Blocker\nS22 Ultra / One UI 8"
            textSize = 22f
            setPadding(0, 0, 0, 24)
        }
        root.addView(title)

        val info = TextView(this).apply {
            text = "This creates an invisible touch-blocking strip at the selected edge. Start with 5 mm. If ghost touches still pull down Quick Panel, try 7 mm or 10 mm."
            textSize = 16f
            setPadding(0, 0, 0, 24)
        }
        root.addView(info)

        val openSettings = Button(this).apply {
            text = "1. Open Accessibility Settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }
        root.addView(openSettings)

        val edgeSelectionTitle = TextView(this).apply {
            text = "Select edges to block:"
            textSize = 16f
            setPadding(0, 0, 0, 16)
        }
        root.addView(edgeSelectionTitle)

        val prefs = getSharedPreferences("settings", MODE_PRIVATE)
        val selectedEdges = prefs.getStringSet("edges", null)?.toMutableSet()
            ?: mutableSetOf(
                prefs.getString("edge", EDGE_TOP) ?: EDGE_TOP
            )

        fun edgeCheckBox(label: String, edge: String): CheckBox {
            return CheckBox(this).apply {
                text = label
                isChecked = selectedEdges.contains(edge)
                setOnCheckedChangeListener { _, checked ->
                    if (checked) {
                        selectedEdges.add(edge)
                    } else {
                        selectedEdges.remove(edge)
                    }
                }
            }
        }

        root.addView(edgeCheckBox("Top", EDGE_TOP))
        root.addView(edgeCheckBox("Left", EDGE_LEFT))
        root.addView(edgeCheckBox("Right", EDGE_RIGHT))
        root.addView(edgeCheckBox("Bottom", EDGE_BOTTOM))

        val applyEdges = Button(this).apply {
            text = "Apply selected edges"
            setOnClickListener {
                prefs.edit()
                    .putStringSet("edges", selectedEdges.toSet())
                    .apply()
                sendBroadcast(Intent(ACTION_REFRESH))
                Toast.makeText(this@MainActivity, "Edge selection updated", Toast.LENGTH_SHORT).show()
            }
        }
        root.addView(applyEdges)

        fun sizeButton(label: String, mm: Float): Button {
            return Button(this).apply {
                text = "Set ${label} mm and refresh"
                setOnClickListener {
                    getSharedPreferences("settings", MODE_PRIVATE)
                        .edit().putFloat("height_mm", mm).apply()
                    sendBroadcast(Intent(ACTION_REFRESH))
                    Toast.makeText(this@MainActivity, "${label} mm selected", Toast.LENGTH_SHORT).show()
                }
            }
        }

        root.addView(sizeButton("5", 5f))
        root.addView(sizeButton("7", 7f))
        root.addView(sizeButton("10", 10f))

        val stop = Button(this).apply {
            text = "Stop blocker"
            setOnClickListener {
                getSharedPreferences("settings", MODE_PRIVATE)
                    .edit().putBoolean("enabled", false).apply()
                sendBroadcast(Intent(ACTION_REFRESH))
                Toast.makeText(this@MainActivity, "Blocker disabled", Toast.LENGTH_SHORT).show()
            }
        }
        root.addView(stop)

        val start = Button(this).apply {
            text = "Start blocker"
            setOnClickListener {
                getSharedPreferences("settings", MODE_PRIVATE)
                    .edit().putBoolean("enabled", true).apply()
                sendBroadcast(Intent(ACTION_REFRESH))
                Toast.makeText(this@MainActivity, "Blocker enabled", Toast.LENGTH_SHORT).show()
            }
        }
        root.addView(start)

        setContentView(root)
    }

    companion object {
        const val ACTION_REFRESH = "com.example.topedgeblocker.REFRESH"
        const val EDGE_TOP = "top"
        const val EDGE_LEFT = "left"
        const val EDGE_RIGHT = "right"
        const val EDGE_BOTTOM = "bottom"
    }
}
