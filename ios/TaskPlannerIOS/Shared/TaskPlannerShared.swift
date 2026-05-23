import Foundation

public enum TaskPlannerShared {
    public static let appGroup = "group.com.example.taskplanner" // Замените на свой App Group ID
    public static let apiBaseKey = "sync_api_base"
    public static let tokenKey = "sync_token"

    public static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }

    public static func save(apiBase: String, token: String) {
        defaults.set(apiBase.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: apiBaseKey)
        defaults.set(token, forKey: tokenKey)
    }

    public static var apiBase: String {
        defaults.string(forKey: apiBaseKey) ?? ""
    }

    public static var token: String {
        defaults.string(forKey: tokenKey) ?? ""
    }
}

public struct WidgetTask: Codable, Identifiable, Hashable {
    public let id: String
    public let title: String
    public let dueDate: String
    public let priority: String
    public let status: String
}

public struct WidgetSummary: Codable, Hashable {
    public let ok: Bool
    public let telegramId: String?
    public let revision: Int
    public let updatedAt: String?
    public let total: Int
    public let open: Int
    public let done: Int
    public let today: Int
    public let next: [WidgetTask]

    public static let empty = WidgetSummary(ok: true, telegramId: nil, revision: 0, updatedAt: nil, total: 0, open: 0, done: 0, today: 0, next: [])
}

public actor TaskPlannerSyncClient {
    public init() {}

    public func fetchSummary() async -> WidgetSummary {
        let apiBase = TaskPlannerShared.apiBase
        let token = TaskPlannerShared.token
        guard !apiBase.isEmpty, !token.isEmpty else { return .empty }
        guard let url = URL(string: "\(apiBase)/widget/summary") else { return .empty }

        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return .empty }
            return try JSONDecoder().decode(WidgetSummary.self, from: data)
        } catch {
            return .empty
        }
    }
}
