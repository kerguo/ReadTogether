# ReadTogether Backend

Spring Boot 后端服务，当前实现登录注册与 JWT 鉴权。

## 运行

```bash
cd backend
mvn spring-boot:run
```

服务默认监听 `http://localhost:8080`，本地数据库使用 SQLite 文件库 `backend/data/readtogether.db`。

## 环境变量

- `PORT`: 服务端口，默认 `8080`
- `JWT_SECRET`: JWT 签名密钥，生产环境必须替换，至少 32 个字符
- `JWT_EXPIRATION_SECONDS`: Token 有效期，默认 `86400`
- `CORS_ALLOWED_ORIGINS`: 允许跨域的前端地址，默认 `http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173`
- `DB_URL`: SQLite 连接地址，默认 `jdbc:sqlite:./data/readtogether.db`
- `MAIL_ENABLED`: 是否启用真实邮件发送，默认 `true`（测试环境可设为 `false`）
- `MAIL_HOST`: SMTP 主机，默认 `smtp.gmail.com`
- `MAIL_PORT`: SMTP 端口，默认 `587`
- `MAIL_USERNAME`: SMTP 用户名（Gmail 邮箱地址）
- `MAIL_PASSWORD`: SMTP 密码（Gmail 需要使用 App Password）
- `MAIL_FROM`: 发件人邮箱，默认 `admin@readtogether.com`

### Gmail 配置示例

```bash
export MAIL_USERNAME="your-account@gmail.com"
export MAIL_PASSWORD="your_app_password"
export MAIL_FROM="admin@readtogether.com"
```

然后重启后端服务，注册后验证码会发送到目标邮箱。

注意：如果使用 Gmail SMTP，`MAIL_FROM` 可能需要与 Gmail 账号或已验证别名一致，否则会被拒发或被改写。

## 接口

### 注册（发送验证码）

`POST /api/auth/register`

```json
{
  "email": "reader@example.com",
  "displayName": "Reader",
  "password": "password123"
}
```

返回示例：

```json
{
  "email": "reader@example.com",
  "message": "Verification code has been sent to your email"
}
```

### 验证邮箱

`POST /api/auth/verify-email`

```json
{
  "email": "reader@example.com",
  "verificationCode": "123456"
}
```

验证成功后返回登录态（`accessToken`）。

### 重发验证码

`POST /api/auth/resend-verification`

```json
{
  "email": "reader@example.com"
}
```

### 微信扫码注册（演示版）

`POST /api/auth/wechat/qr/start`：创建扫码会话并返回二维码 URL。

`GET /api/auth/wechat/qr/status?sessionId=<id>`：轮询扫码状态（`PENDING`/`CONFIRMED`/`EXPIRED`）。

`POST /api/auth/wechat/qr/mock-confirm`：本地演示用，模拟微信确认扫码。

`GET /api/auth/wechat/qr/mock-scan?sessionId=<id>`：扫码访问确认页，会自动完成 mock 确认。

本地手机扫码时，默认 `http://localhost:8080` 手机无法访问。请配置：

```bash
export WECHAT_MOCK_SCAN_BASE_URL="http://<你的局域网IP>:8080"
```

然后重启后端，再扫码即可。

### 登录

`POST /api/auth/login`

```json
{
  "email": "reader@example.com",
  "password": "password123"
}
```

说明：邮箱未验证时，登录会返回 `400`，提示 `Email is not verified`。

### 当前用户

`GET /api/auth/me`

请求头：

```text
Authorization: Bearer <accessToken>
```
