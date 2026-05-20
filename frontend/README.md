<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ReadTogether Frontend

React/Vite frontend for the ReadTogether reading room experience.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Configure the backend URL if it is not running on `http://localhost:8080`:
   `VITE_API_BASE_URL=http://localhost:8080`
3. Run the app:
   `npm run dev`

## Reading Room Voice

Voice uses LiveKit through the backend token endpoint. The frontend does not need LiveKit secrets. Configure these on the backend instead:

- `VOICE_ENABLED=true`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Localhost can use microphone permissions without HTTPS. Production deployments must serve the frontend over HTTPS for microphone access.
