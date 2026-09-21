import Foundation
import Security

// 凭据仅通过标准输入输出与受信任的本机组件交换，不能出现在命令行参数中。
func run() throws -> [String: Any] {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard input.count < 65536,
          let request = try JSONSerialization.jsonObject(with: input) as? [String: String],
          let operation = request["operation"],
          let account = request["account"],
          account.range(of: "^[a-zA-Z0-9_-]{1,100}$", options: .regularExpression) != nil else {
        return ["error": "凭据请求格式错误"]
    }
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.youtube-note.credentials",
        kSecAttrAccount as String: account
    ]
    if operation == "set", let secret = request["secret"], !secret.isEmpty {
        let attributes = [kSecValueData as String: Data(secret.utf8)]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = Data(secret.utf8)
            item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(item as CFDictionary, nil)
        }
        return status == errSecSuccess ? ["saved": true] : ["error": "钥匙串写入失败（\(status)）"]
    }
    guard operation == "get" else { return ["error": "不支持的凭据操作"] }
    var readQuery = query
    readQuery[kSecReturnData as String] = true
    readQuery[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(readQuery as CFDictionary, &result)
    if status == errSecItemNotFound { return ["missing": true] }
    guard status == errSecSuccess, let data = result as? Data, let secret = String(data: data, encoding: .utf8) else {
        return ["error": "钥匙串读取失败（\(status)）"]
    }
    return ["secret": secret]
}
do {
    let output = try JSONSerialization.data(withJSONObject: run())
    FileHandle.standardOutput.write(output)
} catch {
    FileHandle.standardOutput.write(Data("{\"error\":\"凭据操作失败\"}".utf8))
    exit(1)
}
