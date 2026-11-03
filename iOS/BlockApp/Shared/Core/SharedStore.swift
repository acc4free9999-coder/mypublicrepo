import Foundation

/// File-based storage in the App Group container. Runtime updates use `NSFileCoordinator`
/// because the app and several extension processes may write concurrently.
struct SharedStore: Sendable {
    let directory: URL

    init(directory: URL = AppGroup.containerURL) {
        self.directory = directory
    }

    private var configurationURL: URL { directory.appending(path: "configuration.json") }
    private var runtimeURL: URL { directory.appending(path: "runtime.json") }

    func loadConfiguration() -> BlockingConfiguration {
        Self.decode(BlockingConfiguration.self, at: configurationURL) ?? BlockingConfiguration()
    }

    func saveConfiguration(_ configuration: BlockingConfiguration) throws {
        var coordinationError: NSError?
        var writeError: Error?
        NSFileCoordinator().coordinate(writingItemAt: configurationURL, options: .forReplacing, error: &coordinationError) { url in
            do { try Self.encode(configuration, to: url) } catch { writeError = error }
        }
        if let error = coordinationError ?? writeError { throw error }
    }

    func loadRuntime() -> RuntimeState {
        var state: RuntimeState?
        var error: NSError?
        NSFileCoordinator().coordinate(readingItemAt: runtimeURL, options: [], error: &error) { url in
            state = Self.decode(RuntimeState.self, at: url)
        }
        return state ?? RuntimeState()
    }

    /// Atomic read-modify-write of the runtime state.
    @discardableResult
    func updateRuntime<T>(_ body: (inout RuntimeState) -> T) -> T? {
        var result: T?
        var error: NSError?
        NSFileCoordinator().coordinate(writingItemAt: runtimeURL, options: .forMerging, error: &error) { url in
            var state = Self.decode(RuntimeState.self, at: url) ?? RuntimeState()
            result = body(&state)
            try? Self.encode(state, to: url)
        }
        return result
    }

    private static func decode<T: Decodable>(_ type: T.Type, at url: URL) -> T? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func encode<T: Encodable>(_ value: T, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(value)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
}
