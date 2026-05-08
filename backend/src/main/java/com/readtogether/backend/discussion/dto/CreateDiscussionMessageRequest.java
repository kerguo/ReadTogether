package com.readtogether.backend.discussion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDiscussionMessageRequest(
        @NotBlank @Size(max = 2000) String text
) {
}
