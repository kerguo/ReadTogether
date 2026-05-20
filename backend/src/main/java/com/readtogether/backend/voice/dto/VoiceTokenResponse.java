package com.readtogether.backend.voice.dto;

public record VoiceTokenResponse(
        String serverUrl,
        String token,
        String roomName,
        String participantName,
        String participantId
) {
}
