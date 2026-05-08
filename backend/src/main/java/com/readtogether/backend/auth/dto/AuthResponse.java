package com.readtogether.backend.auth.dto;

public record AuthResponse(
        String tokenType,
        String accessToken,
        long expiresIn,
        UserResponse user
) {
}
