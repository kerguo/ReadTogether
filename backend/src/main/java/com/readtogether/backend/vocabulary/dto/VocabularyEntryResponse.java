package com.readtogether.backend.vocabulary.dto;

import com.readtogether.backend.vocabulary.VocabularyEntry;

import java.time.Instant;

public record VocabularyEntryResponse(
        Long id,
        String bookId,
        String userEmail,
        String word,
        String context,
        Instant createdAt
) {
    public static VocabularyEntryResponse from(VocabularyEntry entry) {
        return new VocabularyEntryResponse(
                entry.getId(),
                entry.getBookId(),
                entry.getUser().getEmail(),
                entry.getWord(),
                entry.getContext(),
                entry.getCreatedAt()
        );
    }
}
