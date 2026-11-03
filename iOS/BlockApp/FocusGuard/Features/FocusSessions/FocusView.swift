import SwiftData
import SwiftUI
import FocusGuardKit

struct FocusView: View {
    @Environment(FocusSessionController.self) private var controller
    @Environment(PreferencesStore.self) private var preferences
    @Environment(BlockingEngine.self) private var engine
    @Query(sort: \FocusSession.startDate, order: .reverse) private var sessions: [FocusSession]
    @State private var model: FocusViewModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.l) {
                    AuthorizationRequiredBanner()
                    if let active = sessions.first(where: { $0.status == .active }) {
                        ActiveSessionCard(session: active) { model?.end(active) }
                    } else if let model {
                        FocusSetupCard(model: model)
                    }
                    FocusStatsSection(sessions: sessions)
                    historySection
                }
                .padding(Spacing.m)
            }
            .background(Color.fgBackground)
            .navigationTitle("Focus")
            .animation(.fgSpring, value: sessions.first?.statusRaw)
            .task(id: sessions.first(where: { $0.status == .active })?.id) {
                guard let active = sessions.first(where: { $0.status == .active }) else { return }
                let wait = active.endDate.timeIntervalSinceNow
                if wait > 0 { try? await Task.sleep(for: .seconds(wait)) }
                if !Task.isCancelled { engine.synchronize() }
            }
        }
        .onAppear {
            if model == nil { model = FocusViewModel(controller: controller, preferences: preferences) }
        }
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            SectionHeader(title: "History")
            let finished = sessions.filter { $0.status != .active }
            if finished.isEmpty {
                Card {
                    Text("Completed and interrupted sessions will appear here.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
            } else {
                Card(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(finished.prefix(20)) { session in
                            FocusHistoryRow(session: session)
                                .padding(.horizontal, Spacing.m)
                                .padding(.vertical, Spacing.s)
                            if session.id != finished.prefix(20).last?.id { Divider().padding(.leading, Spacing.m) }
                        }
                    }
                }
            }
        }
    }
}

private struct FocusSetupCard: View {
    @Bindable var model: FocusViewModel
    @Query(sort: \AppBlockGroup.createdAt) private var groups: [AppBlockGroup]
    @State private var showTargets = false

    var body: some View {
        Card(padding: Spacing.l) {
            VStack(spacing: Spacing.l) {
                ProgressRing(progress: 1, lineWidth: 16, tint: .accentColor) {
                    VStack(spacing: 2) {
                        Text("\(model.minutes)")
                            .font(.system(size: 56, weight: .bold, design: .rounded))
                            .contentTransition(.numericText())
                        Text("minutes").font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                .frame(width: 200, height: 200)
                .animation(.fgSpring, value: model.minutes)

                HStack(spacing: Spacing.xs) {
                    ForEach(FocusViewModel.presets, id: \.self) { preset in
                        ChipButton(title: "\(preset)m", isSelected: model.minutes == preset) { model.minutes = preset }
                    }
                    ChipButton(title: "Custom", isSelected: model.isCustomDuration) {
                        if !model.isCustomDuration { model.minutes = 90 }
                    }
                }
                if model.isCustomDuration {
                    Stepper("\(DurationFormat.minutes(model.minutes))", value: $model.minutes, in: FocusSessionController.minimumMinutes...FocusSessionController.maximumMinutes, step: 5)
                }

                Button { showTargets = true } label: {
                    HStack {
                        Label("Block during session", systemImage: "lock.app.dashed")
                        Spacer()
                        Text(targetSummary).foregroundStyle(.secondary).lineLimit(1)
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                    }
                    .font(.subheadline)
                }
                .buttonStyle(.plain)

                if let error = model.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(Color.fgDanger)
                }

                Button {
                    model.start(groups: groups)
                } label: {
                    Label("Start Focus", systemImage: "play.fill")
                }
                .buttonStyle(.primary)
                .disabled(!model.canStart)
                .opacity(model.canStart ? 1 : 0.5)
                .sensoryFeedback(.impact, trigger: model.errorMessage == nil)
            }
        }
        .sheet(isPresented: $showTargets) {
            NavigationStack {
                Form {
                    TargetsSection(groupIDs: $model.groupIDs, selection: $model.selection)
                }
                .navigationTitle("Apps to Block")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { Button("Done") { showTargets = false } }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var targetSummary: String {
        let names = groups.filter { model.groupIDs.contains($0.id) }.map(\.name)
        var parts = names
        if !model.selection.isEmpty { parts.append(model.selection.summary) }
        return parts.isEmpty ? "Choose" : parts.joined(separator: ", ")
    }
}

private struct ActiveSessionCard: View {
    let session: FocusSession
    let onEnd: () -> Void
    @State private var confirmEnd = false

    var body: some View {
        Card(padding: Spacing.l) {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let remaining = session.endDate.timeIntervalSince(context.date)
                let progress = FocusViewModel.progress(of: session, at: context.date)
                VStack(spacing: Spacing.l) {
                    StatusBadge(text: "Focusing", symbol: "lock.fill", tint: .accentColor)
                    ProgressRing(progress: progress, lineWidth: 18, tint: .accentColor) {
                        VStack(spacing: Spacing.xxs) {
                            Text(DurationFormat.countdown(remaining))
                                .font(.system(size: 48, weight: .bold, design: .rounded).monospacedDigit())
                                .contentTransition(.numericText(countsDown: true))
                            Text("Ends at \(session.endDate.formatted(date: .omitted, time: .shortened))")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 240, height: 240)
                    Text("\(Int(progress * 100))% complete")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                    Button("End Session", role: .destructive) { confirmEnd = true }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .confirmationDialog("End focus session early?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End Session", role: .destructive, action: onEnd)
        } message: {
            Text("It will be recorded as ended early and your apps will unlock.")
        }
    }
}

struct FocusStatsSection: View {
    let sessions: [FocusSession]

    var body: some View {
        let stats = FocusStatistics.compute(sessions.map(\.record), now: .now, calendar: .current)
        VStack(alignment: .leading, spacing: Spacing.s) {
            SectionHeader(title: "Statistics")
            Grid(horizontalSpacing: Spacing.s, verticalSpacing: Spacing.s) {
                GridRow {
                    StatTile(title: "Sessions completed", value: "\(stats.completedCount)", symbol: "checkmark.circle.fill", tint: .fgSuccess)
                    StatTile(title: "Total focus", value: DurationFormat.minutes(stats.totalFocusMinutes), symbol: "clock.fill", tint: .accentColor)
                }
                GridRow {
                    StatTile(title: "Completion rate", value: "\(Int(stats.completionRate * 100))%", symbol: "chart.pie.fill", tint: .purple)
                    StatTile(title: "Day streak", value: "\(stats.currentStreakDays)", symbol: "flame.fill", tint: .orange)
                }
            }
            FocusChart(days: stats.lastSevenDays)
        }
    }
}

private struct FocusHistoryRow: View {
    let session: FocusSession

    var body: some View {
        HStack(spacing: Spacing.s) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(DurationFormat.minutes(Int(session.duration / 60))).font(.subheadline.weight(.semibold))
                Text(session.startDate.formatted(.dateTime.weekday(.abbreviated).day().month().hour().minute()))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(session.status.title).font(.caption.weight(.medium)).foregroundStyle(tint)
        }
        .accessibilityElement(children: .combine)
    }

    private var symbol: String {
        switch session.status {
        case .completed: "checkmark.circle.fill"
        case .cancelled: "xmark.circle.fill"
        case .interrupted: "exclamationmark.circle.fill"
        case .active: "timer"
        }
    }

    private var tint: Color {
        switch session.status {
        case .completed: .fgSuccess
        case .cancelled: .fgWarning
        case .interrupted: .fgDanger
        case .active: .accentColor
        }
    }
}
