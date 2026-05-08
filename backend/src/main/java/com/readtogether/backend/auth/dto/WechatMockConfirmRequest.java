package com.readtogether.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WechatMockConfirmRequest(
        @NotBlank String sessionId,
        @NotBlank @Size(max = 128) String wechatOpenId,
        @NotBlank @Size(min = 2, max = 120) String displayName
) {
}
