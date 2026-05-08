package com.readtogether.backend.auth.dto;

public record WechatQrStatusResponse(
        String status,
        AuthResponse auth
) {
}
