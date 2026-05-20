---
name: readtogether-local
description: Use when working in the ReadTogether project, especially local frontend/backend development, Reading Room voice, LiveKit setup, browser verification, and project-specific test commands.
---

# ReadTogether Local

## Project Shape

- Frontend: React/Vite app in `frontend/`, normally served at `http://localhost:3002/`.
- Backend: Spring Boot app in `backend/`, normally served at `http://localhost:8081`.
- Voice: LiveKit for Reading Room audio, normally at `ws://localhost:7880`.
- Database: backend local SQLite database at `backend/data/readtogether.db`.

## Local Services

Start LiveKit for voice testing:

```bash
docker run --rm --name readtogether-livekit-local \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server --dev --bind 0.0.0.0
```

Start backend with voice enabled:

```bash
cd backend
env PORT=8081 MAIL_ENABLED=false VOICE_ENABLED=true \
  LIVEKIT_URL=ws://localhost:7880 \
  LIVEKIT_API_KEY=devkey \
  LIVEKIT_API_SECRET=secret \
  mvn spring-boot:run
```

Start frontend:

```bash
cd frontend
env VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --port=3002
```

If a local server command fails with sandbox/port permission errors, rerun that same service command with escalated local-service permission instead of changing ports first.

## Verification

Run focused checks before reporting completion:

```bash
cd frontend && npm run lint
cd backend && mvn test
```

For browser checks, open `http://localhost:3002/`. Use the Browser plugin for automated local UI verification when available, but use the user's real browser when microphone hardware or permission prompts must be accepted by the user.

## Voice Workflow

Reading Room voice depends on all three services: frontend, backend, and LiveKit.

Expected voice token endpoint:

```text
POST /api/books/{bookId}/voice/token
Authorization: Bearer <accessToken>
```

Expected room naming: `book-{bookId}`.

Local LiveKit dev credentials:

```text
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

When testing microphone behavior:

- `localhost` is acceptable for browser microphone permission without HTTPS.
- A test browser environment may have no microphone device; treat `No microphone was found` as a hardware/environment result, not necessarily an app regression.
- To verify actual permission acceptance, have the user use a local browser with a real microphone and click the Voice panel join/unmute control.

## Temporary Test Users

For local manual checks, create a clearly named temporary user through the backend API and verify it with the SQLite email code. Remove temporary users from `backend/data/readtogether.db` after the test unless the user asks to keep them.

