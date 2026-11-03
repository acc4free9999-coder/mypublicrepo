import DeviceActivity
import SwiftData
import SwiftUI
import FocusGuardKit

struct DashboardView: View {
    @Environment(BlockingEngine.self) private var engine
    @Environment(AppRouter.self) private var router
    @Query(sort: \UsageLimit.createdAt) private var limits: [UsageLimit]
    @Query(sort: \BlockingSchedule.startMinutes) private var schedules: [BlockingSchedule]
    @Query(sort: \FocusSession.startDate, order: .reverse) private var sessions: [FocusSession]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    header
                    AuthorizationRequiredBanner()
                    blockingNowCard
                    statsGrid
                    focusCard
                    screenTimeCard
                    limitsSection
                    schedulesSection
                    FocusStatsSection(sessions: sessions)
                }
                .padding(Spacing.m)
            }
            .background(Color.fgBackground)
            .navigationTitle("Home")
            .toolbarTitleDisplayMode(.inlineLarge)
            .refreshable { engine.synchronize() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)).uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(DashboardViewModel.greeting())
                .font(.title.weight(.bold))
        }
        .padding(.horizontal, Spacing.xxs)
    }

    private var blockingNowCard: some View {
        let blockers = DashboardViewModel.activeBlockers(engine: engine)
        let blockedCount = DashboardViewModel.blockedAppCount(engine.blockedSelection)
        let categories = engine.blockedSelection.categoryTokens.count
        let total = max(1, DashboardViewModel.blockedAppCount(engine.allTargetedSelection))

        return Card(padding: Spacing.l) {
            HStack(spacing: Spacing.l) {
                ProgressRing(progress: blockers.isEmpty ? 0 : Double(blockedCount) / Double(total), lineWidth: 14, tint: blockers.isEmpty ? .fgSuccess : .accentColor) {
                    Image(systemName: blockers.isEmpty ? "lock.open.fill" : "lock.fill")
                        .font(.title)
                        .foregroundStyle(blockers.isEmpty ? Color.fgSuccess : Color.accentColor)
                        .contentTransition(.symbolEffect(.replace))
                }
                .frame(width: 96, height: 96)
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(blockers.isEmpty ? "Nothing blocked" : "Blocking now")
                        .font(.headline)
                    if blockers.isEmpty {
                        Text("Your apps are available.").font(.subheadline).foregroundStyle(.secondary)
                    } else {
                        Text(blockedSummary(apps: blockedCount, categories: categories))
                            .font(.subheadline).foregroundStyle(.secondary)
                        ForEach(blockers.prefix(3)) { blocker in
                            Label {
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(blocker.name).font(.subheadline.weight(.medium))
                                    Text(blocker.detail).font(.caption).foregroundStyle(.secondary)
                                }
                            } icon: {
                                Image(systemName: blocker.symbol).foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private func blockedSummary(apps: Int, categories: Int) -> String {
        var parts: [String] = []
        if apps > 0 { parts.append("\(apps) app\(apps == 1 ? "" : "s")") }
        if categories > 0 { parts.append("\(categories) categor\(categories == 1 ? "y" : "ies")") }
        return parts.isEmpty ? "Rules active" : parts.joined(separator: " and ") + " blocked"
    }

    private var statsGrid: some View {
        Grid(horizontalSpacing: Spacing.s, verticalSpacing: Spacing.s) {
            GridRow {
                StatTile(title: "Apps in your rules", value: "\(DashboardViewModel.blockedAppCount(engine.allTargetedSelection))", symbol: "square.stack.3d.up.fill", tint: .indigo)
                StatTile(title: "Blocked right now", value: "\(DashboardViewModel.blockedAppCount(engine.blockedSelection))", symbol: "lock.fill", tint: .fgDanger)
            }
            GridRow {
                StatTile(title: "Active schedules", value: "\(schedules.filter { engine.isActive($0.ruleKey) }.count)", symbol: "calendar.badge.clock", tint: .blue)
                StatTile(title: "Distractions resisted today", value: "\(engine.state.shieldDismissalsToday)", symbol: "hand.raised.fill", tint: .orange)
            }
        }
    }

    @ViewBuilder
    private var focusCard: some View {
        if let active = sessions.first(where: { $0.status == .active }) {
            Button { router.selectedTab = .focus } label: {
                Card {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        HStack(spacing: Spacing.m) {
                            ProgressRing(progress: FocusViewModel.progress(of: active, at: context.date), lineWidth: 8)
                                .frame(width: 52, height: 52)
                            VStack(alignment: .leading) {
                                Text("Focus session").font(.headline)
                                Text("\(DurationFormat.countdown(active.endDate.timeIntervalSince(context.date))) remaining")
                                    .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
        } else {
            Button { router.selectedTab = .focus } label: {
                Card {
                    HStack(spacing: Spacing.m) {
                        IconBadge(symbol: "timer", tint: .purple)
                        VStack(alignment: .leading) {
                            Text("Start a focus session").font(.headline)
                            Text("Block distractions for 15 – 60 minutes.").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "play.circle.fill").font(.title).foregroundStyle(Color.accentColor)
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }

    private var screenTimeCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            SectionHeader(title: "Screen Time today", subtitle: "Provided privately by iOS")
            Card {
                DeviceActivityReport(.totalActivity, filter: DeviceActivityFilter(
                    segment: .daily(during: DateInterval(start: Calendar.current.startOfDay(for: .now), end: .now)),
                    users: .all,
                    devices: .init([.iPhone, .iPad])
                ))
                .frame(minHeight: 240)
            }
        }
    }

    @ViewBuilder
    private var limitsSection: some View {
        let enabled = limits.filter(\.isEnabled)
        if !enabled.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s) {
                SectionHeader(title: "Daily limits", actionTitle: "Manage") { router.selectedTab = .apps }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s) {
                        ForEach(enabled) { limit in
                            LimitRingCard(limit: limit)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var schedulesSection: some View {
        let upcoming = DashboardViewModel.upcomingSchedules(schedules, engine: engine)
        if !upcoming.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s) {
                SectionHeader(title: "Schedules", actionTitle: "Manage") { router.selectedTab = .schedule }
                Card(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(upcoming) { item in
                            HStack {
                                Circle()
                                    .fill(item.isActive ? Color.fgDanger : Color.accentColor.opacity(0.4))
                                    .frame(width: 10, height: 10)
                                VStack(alignment: .leading) {
                                    Text(item.name).font(.subheadline.weight(.semibold))
                                    Text(item.detail).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding(Spacing.m)
                            if item.id != upcoming.last?.id { Divider().padding(.leading, Spacing.xl) }
                        }
                    }
                }
            }
        }
    }
}

private struct LimitRingCard: View {
    let limit: UsageLimit
    @Environment(BlockingEngine.self) private var engine

    var body: some View {
        let used = engine.usedMinutes(for: limit.id)
        let progress = UsageLimitCalculator.progress(used: used, limit: limit.dailyLimitMinutes)
        let reached = engine.isActive(limit.ruleKey)
        let tint: Color = reached ? .fgDanger : progress >= 0.8 ? .fgWarning : .accentColor

        Card {
            VStack(spacing: Spacing.s) {
                ProgressRing(progress: progress, lineWidth: 10, tint: tint) {
                    VStack(spacing: 0) {
                        Text("\(UsageLimitCalculator.remainingMinutes(used: used, limit: limit.dailyLimitMinutes))")
                            .font(.fgNumber)
                        Text("min left").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .frame(width: 92, height: 92)
                Text(limit.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text("\(used) / \(limit.dailyLimitMinutes) min").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            .frame(width: 120)
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
    }
}
