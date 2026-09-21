import Foundation
import Security
import LocalAuthentication

// 只查询随机且不存在的条目，不读取已有凭据，不写入或删除钥匙串项目。
let service = "youtube-note.readonly-probe.\(UUID().uuidString)"
let authenticationContext = LAContext()
authenticationContext.interactionNotAllowed = true
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecReturnData as String: false,
    kSecUseAuthenticationContext as String: authenticationContext
]
let status = SecItemCopyMatching(query as CFDictionary, nil)
let expected = status == errSecItemNotFound
let report: [String: Any] = [
    "check": "只读钥匙串接口预检",
    "status": Int(status),
    "expectedItemNotFound": expected,
    "credentialWriteTested": false,
    "nativeMessagingTested": false
]
do {
    let data = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
} catch {
    FileHandle.standardError.write(Data("预检结果编码失败\n".utf8))
    exit(2)
}
exit(expected ? 0 : 1)
