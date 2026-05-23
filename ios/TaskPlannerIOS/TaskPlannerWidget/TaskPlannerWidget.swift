import WidgetKit
import SwiftUI

struct TaskPlannerEntry: TimelineEntry {
    let date: Date
    let summary: WidgetSummary
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> TaskPlannerEntry {
        TaskPlannerEntry(date: Date(), summary: WidgetSummary.empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (TaskPlannerEntry) -> Void) {
        Task {
            let summary = await TaskPlannerSyncClient().fetchSummary()
            completion(TaskPlannerEntry(date: Date(), summary: summary))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TaskPlannerEntry>) -> Void) {
        Task {
            let summary = await TaskPlannerSyncClient().fetchSummary()
            let entry = TaskPlannerEntry(date: Date(), summary: summary)
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }
}

struct TaskPlannerWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .systemMedium:
            mediumView
        default:
            largeView
        }
    }

    private var header: some View {
        HStack {
            Image(systemName: "checklist")
                .font(.headline)
            Text("Задачи")
                .font(.headline.weight(.bold))
            Spacer()
            if entry.summary.today > 0 {
                Text("\(entry.summary.today) сегодня")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(.blue.opacity(0.15), in: Capsule())
            }
        }
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            Text("\(entry.summary.open)")
                .font(.system(size: 42, weight: .black, design: .rounded))
                .contentTransition(.numericText())
            Text("открытых задач")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
        }
        .containerBackground(.background, for: .widget)
    }

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            HStack(spacing: 14) {
                metric("Всего", entry.summary.total)
                metric("В работе", entry.summary.open)
                metric("Готово", entry.summary.done)
            }
            Divider()
            taskList(limit: 2)
        }
        .containerBackground(.background, for: .widget)
    }

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            HStack(spacing: 14) {
                metric("Всего", entry.summary.total)
                metric("Открыто", entry.summary.open)
                metric("Сегодня", entry.summary.today)
                metric("Готово", entry.summary.done)
            }
            Divider()
            taskList(limit: 6)
            Spacer(minLength: 0)
        }
        .containerBackground(.background, for: .widget)
    }

    private func metric(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.title3.weight(.black))
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func taskList(limit: Int) -> some View {
        if entry.summary.next.isEmpty {
            Text(TaskPlannerShared.token.isEmpty ? "Откройте приложение и вставьте sync-ссылку" : "Нет ближайших задач")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else {
            ForEach(entry.summary.next.prefix(limit)) { task in
                HStack(spacing: 6) {
                    Circle()
                        .fill(color(for: task.priority))
                        .frame(width: 6, height: 6)
                    Text(task.title)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if !task.dueDate.isEmpty {
                        Text(task.dueDate.dropFirst(5).replacingOccurrences(of: "-", with: "."))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func color(for priority: String) -> Color {
        switch priority {
        case "critical": return .red
        case "high": return .orange
        case "medium": return .yellow
        default: return .green
        }
    }
}

struct TaskPlannerWidget: Widget {
    let kind: String = "TaskPlannerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TaskPlannerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Task Planner")
        .description("Ближайшие задачи из Telegram WebApp и PWA на главном экране.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
#Preview(as: .systemMedium) {
    TaskPlannerWidget()
} timeline: {
    TaskPlannerEntry(date: .now, summary: WidgetSummary(ok: true, telegramId: "123", revision: 1, updatedAt: nil, total: 7, open: 4, done: 3, today: 2, next: [
        WidgetTask(id: "1", title: "Проверить синхронизацию", dueDate: "2026-05-23", priority: "high", status: "in-progress"),
        WidgetTask(id: "2", title: "Добавить задачу из Telegram", dueDate: "", priority: "medium", status: "backlog")
    ]))
}
