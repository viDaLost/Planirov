import SwiftUI
import WidgetKit

@main
struct TaskPlannerIOSApp: App {
    var body: some Scene {
        WindowGroup {
            SyncSettingsView()
                .onOpenURL { url in
                    handleSyncDeepLink(url)
                }
        }
    }

    private func handleSyncDeepLink(_ url: URL) {
        guard url.scheme == "taskplanner" else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let api = components?.queryItems?.first(where: { $0.name == "api" })?.value ?? ""
        let token = components?.queryItems?.first(where: { $0.name == "token" })?.value ?? ""
        guard !api.isEmpty, !token.isEmpty else { return }
        TaskPlannerShared.save(apiBase: api, token: token)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

struct SyncSettingsView: View {
    @State private var apiBase = TaskPlannerShared.apiBase
    @State private var token = TaskPlannerShared.token
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Подключение") {
                    TextField("Sync API URL", text: $apiBase)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    SecureField("Sync token", text: $token)
                        .textInputAutocapitalization(.never)
                }

                Section {
                    Button("Сохранить и обновить виджет") {
                        TaskPlannerShared.save(apiBase: apiBase, token: token)
                        WidgetCenter.shared.reloadAllTimelines()
                        saved = true
                    }
                }

                Section("Как связать") {
                    Text("В Telegram WebApp откройте Настройки → Облачная синхронизация → Ссылка для iPhone или Widget-ссылка. Откройте ссылку на iPhone — приложение сохранит токен в App Group, а виджет начнёт показывать ваши задачи.")
                        .font(.footnote)
                }
            }
            .navigationTitle("Task Planner Sync")
            .alert("Сохранено", isPresented: $saved) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("WidgetKit обновит данные при следующем цикле или после перезагрузки таймлайна.")
            }
        }
    }
}
