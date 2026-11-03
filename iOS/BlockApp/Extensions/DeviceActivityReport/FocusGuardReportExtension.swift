import DeviceActivity
import ExtensionKit
@preconcurrency import FamilyControls
import ManagedSettings
import SwiftUI

/// Screen Time data is only readable inside this sandboxed extension; the app embeds its
/// views via `DeviceActivityReport` but never sees the raw numbers.
@main
struct FocusGuardReportExtension: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        TotalActivityReport { TotalActivityView(summary: $0) }
        AppUsageReport { AppUsageListView(entries: $0) }
    }
}

/// `ApplicationToken` is an immutable opaque value that isn't annotated `Sendable` by the SDK.
struct AppUsageEntry: Identifiable, @unchecked Sendable {
    let id: String
    let name: String
    let duration: TimeInterval
    let pickups: Int
    let token: ApplicationToken?
}

struct ActivitySummary: Sendable {
    var total: TimeInterval
    var entries: [AppUsageEntry]
}

nonisolated enum ActivityAggregator {
    static func aggregate(_ data: DeviceActivityResults<DeviceActivityData>) async -> ActivitySummary {
        var total: TimeInterval = 0
        var apps: [String: AppUsageEntry] = [:]
        for await device in data {
            for await segment in device.activitySegments {
                total += segment.totalActivityDuration
                for await category in segment.categories {
                    for await activity in category.applications {
                        let app = activity.application
                        let name = app.localizedDisplayName ?? app.bundleIdentifier ?? "App"
                        let id = app.bundleIdentifier ?? name
                        let previous = apps[id]
                        apps[id] = AppUsageEntry(
                            id: id,
                            name: name,
                            duration: (previous?.duration ?? 0) + activity.totalActivityDuration,
                            pickups: (previous?.pickups ?? 0) + activity.numberOfPickups,
                            token: app.token
                        )
                    }
                }
            }
        }
        return ActivitySummary(total: total, entries: apps.values.sorted { $0.duration > $1.duration })
    }
}

nonisolated struct TotalActivityReport: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .totalActivity
    let content: (ActivitySummary) -> TotalActivityView

    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ActivitySummary {
        var summary = await ActivityAggregator.aggregate(data)
        summary.entries = Array(summary.entries.prefix(5))
        return summary
    }
}

nonisolated struct AppUsageReport: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .appUsage
    let content: ([AppUsageEntry]) -> AppUsageListView

    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> [AppUsageEntry] {
        await ActivityAggregator.aggregate(data).entries
    }
}

private func formatDuration(_ interval: TimeInterval) -> String {
    let formatter = DateComponentsFormatter()
    formatter.allowedUnits = interval >= 3600 ? [.hour, .minute] : [.minute]
    formatter.unitsStyle = .abbreviated
    return formatter.string(from: interval) ?? "0m"
}

struct TotalActivityView: View {
    let summary: ActivitySummary

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(formatDuration(summary.total))
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .contentTransition(.numericText())
            if summary.entries.isEmpty {
                Text("No activity recorded yet today.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                let maxDuration = summary.entries.first?.duration ?? 1
                ForEach(summary.entries) { entry in
                    HStack(spacing: 10) {
                        AppIcon(token: entry.token, name: entry.name)
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(entry.name).font(.subheadline.weight(.medium)).lineLimit(1)
                                Spacer()
                                Text(formatDuration(entry.duration)).font(.subheadline).foregroundStyle(.secondary)
                            }
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(Color.accentColor.gradient)
                                    .frame(width: max(6, proxy.size.width * entry.duration / max(maxDuration, 1)))
                            }
                            .frame(height: 6)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct AppUsageListView: View {
    let entries: [AppUsageEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if entries.isEmpty {
                Text("No usage today for these apps.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(entries) { entry in
                HStack(spacing: 10) {
                    AppIcon(token: entry.token, name: entry.name)
                    VStack(alignment: .leading) {
                        Text(entry.name).font(.subheadline.weight(.medium))
                        Text("\(entry.pickups) pickups").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(formatDuration(entry.duration))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AppIcon: View {
    let token: ApplicationToken?
    let name: String

    var body: some View {
        Group {
            if let token {
                Label(token).labelStyle(.iconOnly)
            } else {
                Image(systemName: "app.fill").foregroundStyle(.secondary)
            }
        }
        .frame(width: 28, height: 28)
        .accessibilityLabel(name)
    }
}
