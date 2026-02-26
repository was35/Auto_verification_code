# Android 短信转发器配置指南

Android 建议使用开源的 **“短信转发器 (SmsForwarder)”** 或者是 **“Tasker”**。

### 使用 SmsForwarder (推荐):

1.  **下载并安装** [SmsForwarder](https://github.com/pppscn/SmsForwarder)。
2.  **添加发送通道**：
    *   选择 **Webhook**。
    *   **Webhook 地址**：填写插件给出的专用链接（如 `http://lly.winorgohome.top:8000/push/你的Token`）。
    *   **请求方法**：POST。
    *   **请求参数**：
        *   `code` : 选择短信内容中的验证码正则提取。
3.  **添加转发规则**：
    *   **匹配文本**：包含“验证码”。
    *   **发送通道**：选择刚才创建的 Webhook。

### 使用 Tasker:

1.  创建一个 **Event** -> **Phone** -> **Received Text**。
2.  创建一个 **Task**：
    *   使用 **Variable Search Replace** 提取 `%SMSRB` 中的验证码到 `%code`。
    *   使用 **HTTP Request**：
        *   **Method**: POST。
        *   **URL**: 你的专用连接。
        *   **Body**: `{"code": "%code"}`。
