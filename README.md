# ReadTogether

ReadTogether 是一个阅读房间应用，包含 React/Vite 前端、Spring Boot 后端和基于 LiveKit 的 Reading Room 语音能力。

## 本地环境地址

- 前端：`http://localhost:3002/`
- 后端：`http://localhost:8081`
- LiveKit：`ws://localhost:7880`

## 前置依赖

- Node.js / npm
- Java 21+ 与 Maven
- Docker（用于本地 LiveKit）
- SQLite CLI（可选，用于查看或清理本地测试数据）

## 启动本地环境

建议按 LiveKit、后端、前端的顺序分别开 3 个终端启动。

### 1. 启动 LiveKit

```bash
docker run --rm --name readtogether-livekit-local \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server --dev --bind 0.0.0.0
```

本地开发模式使用 LiveKit 默认凭据：

```text
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

### 2. 启动后端

```bash
cd backend
env PORT=8081 MAIL_ENABLED=false VOICE_ENABLED=true \
  LIVEKIT_URL=ws://localhost:7880 \
  LIVEKIT_API_KEY=devkey \
  LIVEKIT_API_SECRET=secret \
  mvn spring-boot:run
```

后端默认使用 SQLite 本地文件库：`backend/data/readtogether.db`。

### 3. 启动前端

首次运行先安装依赖：

```bash
cd frontend
npm install
```

启动 Vite：

```bash
cd frontend
env VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --port=3002
```

打开 `http://localhost:3002/`。

## Reading Room 语音验证

语音功能依赖三个服务同时运行：

1. LiveKit：`ws://localhost:7880`
2. 后端：`http://localhost:8081`
3. 前端：`http://localhost:3002/`

进入前端后登录账号，打开 `Reading Rooms`，点击 Voice 面板里的加入按钮。本地 `localhost` 可以直接申请麦克风权限；生产环境必须使用 HTTPS。

后端语音 token 接口：

```text
POST /api/books/{bookId}/voice/token
Authorization: Bearer <accessToken>
```

房间名按书籍生成，例如 `book-1`。

## 常用检查

前端类型检查：

```bash
cd frontend
npm run lint
```

后端测试：

```bash
cd backend
mvn test
```

## Vercel 部署

在 Vercel 项目 **Settings → General → Root Directory** 中，只能使用下面**两种之一**：

1. **推荐：** 填 **`frontend`**（指向含 `package.json` 的源码目录，不要选 `dist` 或 `frontend/dist`）。构建由 `frontend/vercel.json` 与 Vite 完成，产物为 `frontend/dist`。
2. **备选：** 留空（使用**仓库根目录**），由仓库根目录的 `vercel.json` 中 `cd frontend && …` 负责构建与输出路径。

`dist` / `frontend/dist` 是 `npm run build` 的**输出目录**，不会出现在 Git 里，**不要**设成 Root Directory。
