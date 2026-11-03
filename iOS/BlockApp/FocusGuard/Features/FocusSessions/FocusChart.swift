import Charts
import SwiftUI
import FocusGuardKit

struct FocusChart: View {
    let days: [DailyFocus]

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spacing.s) {
                Text("Last 7 days").font(.headline)
                Chart(days) { day in
                    BarMark(
                        x: .value("Day", day.day, unit: .day),
                        y: .value("Minutes", day.minutes)
                    )
                    .foregroundStyle(Color.accentColor.gradient)
                    .cornerRadius(6)
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day)) { _ in
                        AxisValueLabel(format: .dateTime.weekday(.narrow))
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisValueLabel { if let m = value.as(Int.self) { Text("\(m)m") } }
                    }
                }
                .frame(height: 160)
            }
        }
        .accessibilityLabel("Focus minutes over the last seven days")
    }
}
