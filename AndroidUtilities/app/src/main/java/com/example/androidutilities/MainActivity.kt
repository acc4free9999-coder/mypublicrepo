package com.example.androidutilities

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.CompoundButton
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Space
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var cameraManager: CameraManager
    private lateinit var audioManager: AudioManager
    private lateinit var torchSwitch: Switch
    private lateinit var torchStatus: TextView
    private lateinit var brightnessStatus: TextView
    private lateinit var volumeStatus: TextView

    private var torchCameraId: String? = null
    private var torchEnabled = false
    private var pendingTorchAfterPermission = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        cameraManager = getSystemService(CameraManager::class.java)
        audioManager = getSystemService(AudioManager::class.java)
        torchCameraId = findTorchCameraId()

        setContentView(createContentView())
        refreshTorchUi()
        refreshBrightnessStatus()
        refreshVolumeStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshBrightnessStatus()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
            if (granted && pendingTorchAfterPermission) {
                setTorch(true)
            } else if (!granted) {
                toast("Camera permission is required to use the torch.")
                torchSwitch.isChecked = false
            }
            pendingTorchAfterPermission = false
        }
    }

    private fun createContentView(): ScrollView {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 60, 40, 40)
        }

        root.addView(TextView(this).apply {
            text = "Android Utilities"
            textSize = 26f
            setPadding(0, 0, 0, 12)
        })
        root.addView(TextView(this).apply {
            text = "Quick controls for torch, display brightness, media volume, notification center, and control center."
            textSize = 16f
            setPadding(0, 0, 0, 28)
        })

        addTorchSection(root)
        addBrightnessSection(root)
        addVolumeSection(root)
        addSystemPanelsSection(root)

        return ScrollView(this).apply {
            addView(root)
        }
    }

    private fun addTorchSection(root: LinearLayout) {
        addSectionTitle(root, "Torch light")
        torchStatus = TextView(this).apply {
            textSize = 14f
            setPadding(0, 0, 0, 8)
        }
        root.addView(torchStatus)

        torchSwitch = Switch(this).apply {
            text = "Torch off"
            setOnCheckedChangeListener { button, checked ->
                if (checked == torchEnabled) {
                    updateTorchSwitchLabel()
                    return@setOnCheckedChangeListener
                }
                handleTorchSwitch(button, checked)
            }
        }
        root.addView(torchSwitch)
        addGap(root)
    }

    private fun addBrightnessSection(root: LinearLayout) {
        addSectionTitle(root, "Brightness")
        brightnessStatus = TextView(this).apply {
            textSize = 14f
            setPadding(0, 0, 0, 8)
        }
        root.addView(brightnessStatus)

        root.addView(SeekBar(this).apply {
            max = MAX_BRIGHTNESS
            progress = readCurrentBrightness()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        applyBrightness(progress.coerceIn(MIN_BRIGHTNESS, MAX_BRIGHTNESS))
                    }
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit

                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    if (!Settings.System.canWrite(this@MainActivity)) {
                        toast("Grant brightness permission to change system brightness.")
                    }
                }
            })
        })

        root.addView(Button(this).apply {
            text = "Grant brightness permission"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                })
            }
        })
        addGap(root)
    }

    private fun addVolumeSection(root: LinearLayout) {
        addSectionTitle(root, "Media volume")
        volumeStatus = TextView(this).apply {
            textSize = 14f
            setPadding(0, 0, 0, 8)
        }
        root.addView(volumeStatus)

        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        root.addView(SeekBar(this).apply {
            max = maxVolume
            progress = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, progress, AudioManager.FLAG_SHOW_UI)
                        refreshVolumeStatus()
                    }
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit

                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        })
        addGap(root)
    }

    private fun addSystemPanelsSection(root: LinearLayout) {
        addSectionTitle(root, "System panels")
        root.addView(TextView(this).apply {
            text = "Android requires an Accessibility Service for apps to open notification center or control center. Enable Android Utilities in Accessibility Settings first."
            textSize = 14f
            setPadding(0, 0, 0, 8)
        })

        root.addView(Button(this).apply {
            text = "Open Accessibility Settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        })
        root.addView(Button(this).apply {
            text = "Show notification center"
            setOnClickListener {
                performAccessibilityAction(
                    action = { it.showNotificationCenter() },
                    failureMessage = "Could not open notification center."
                )
            }
        })
        root.addView(Button(this).apply {
            text = "Show control center"
            setOnClickListener {
                performAccessibilityAction(
                    action = { it.showControlCenter() },
                    failureMessage = "Could not open control center."
                )
            }
        })
    }

    private fun addSectionTitle(root: LinearLayout, title: String) {
        root.addView(TextView(this).apply {
            text = title
            textSize = 20f
            setPadding(0, 12, 0, 8)
        })
    }

    private fun addGap(root: LinearLayout) {
        root.addView(Space(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                24,
            )
        })
    }

    private fun handleTorchSwitch(button: CompoundButton, checked: Boolean) {
        if (torchCameraId == null) {
            toast("This device does not report a camera flash.")
            button.isChecked = false
            return
        }

        if (checked && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            pendingTorchAfterPermission = true
            requestPermissions(arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA_PERMISSION)
            return
        }

        setTorch(checked)
    }

    private fun setTorch(enabled: Boolean) {
        val cameraId = torchCameraId ?: return
        try {
            cameraManager.setTorchMode(cameraId, enabled)
            torchEnabled = enabled
            refreshTorchUi()
        } catch (error: CameraAccessException) {
            torchSwitch.isChecked = torchEnabled
            toast("Could not change torch: ${error.reason}")
        } catch (error: IllegalArgumentException) {
            torchSwitch.isChecked = torchEnabled
            toast("Could not change torch: ${error.message ?: "camera unavailable"}")
        }
    }

    private fun findTorchCameraId(): String? {
        return try {
            cameraManager.cameraIdList.firstOrNull { cameraId ->
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val hasFlash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                val isBackCamera = characteristics.get(CameraCharacteristics.LENS_FACING) ==
                    CameraCharacteristics.LENS_FACING_BACK
                hasFlash && isBackCamera
            } ?: cameraManager.cameraIdList.firstOrNull { cameraId ->
                cameraManager.getCameraCharacteristics(cameraId)
                    .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }
        } catch (error: CameraAccessException) {
            toast("Could not inspect cameras: ${error.reason}")
            null
        }
    }

    private fun refreshTorchUi() {
        torchStatus.text = if (torchCameraId == null) {
            "No camera flash detected."
        } else {
            "Camera flash is available."
        }
        torchSwitch.isEnabled = torchCameraId != null
        torchSwitch.isChecked = torchEnabled
        updateTorchSwitchLabel()
    }

    private fun updateTorchSwitchLabel() {
        torchSwitch.text = if (torchEnabled) "Torch on" else "Torch off"
    }

    private fun applyBrightness(value: Int) {
        val clamped = value.coerceIn(MIN_BRIGHTNESS, MAX_BRIGHTNESS)
        window.attributes = window.attributes.apply {
            screenBrightness = clamped / MAX_BRIGHTNESS.toFloat()
        }

        if (Settings.System.canWrite(this)) {
            Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, clamped)
        }
        refreshBrightnessStatus()
    }

    private fun readCurrentBrightness(): Int {
        return try {
            Settings.System.getInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS)
        } catch (error: Settings.SettingNotFoundException) {
            DEFAULT_BRIGHTNESS
        }.coerceIn(MIN_BRIGHTNESS, MAX_BRIGHTNESS)
    }

    private fun refreshBrightnessStatus() {
        val value = readCurrentBrightness()
        val permission = if (Settings.System.canWrite(this)) {
            "system brightness enabled"
        } else {
            "app brightness only until permission is granted"
        }
        brightnessStatus.text = "Current brightness: $value / $MAX_BRIGHTNESS ($permission)"
    }

    private fun refreshVolumeStatus() {
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        volumeStatus.text = "Current media volume: $current / $max"
    }

    private fun performAccessibilityAction(
        action: (UtilityAccessibilityService) -> Boolean,
        failureMessage: String,
    ) {
        val service = UtilityAccessibilityService.activeService
        if (service == null) {
            toast("Enable Android Utilities in Accessibility Settings first.")
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            return
        }

        if (!action(service)) {
            toast(failureMessage)
        }
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    companion object {
        private const val REQUEST_CAMERA_PERMISSION = 10
        private const val MIN_BRIGHTNESS = 1
        private const val MAX_BRIGHTNESS = 255
        private const val DEFAULT_BRIGHTNESS = 125
    }
}
