package com.readtogether.backend.vocabulary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateVocabularyEntryRequest(
        @NotBlank @Size(max = 120) String word,
        @Size(max = 1000) String context
) {
}
