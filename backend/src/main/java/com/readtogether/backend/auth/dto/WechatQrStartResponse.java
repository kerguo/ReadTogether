package com.readtogether.backend.auth.dto;

public record WechatQrStartResponse(
        String sessionId,
        String qrCodeUrl,
        long expiresInSeconds
) {
}
