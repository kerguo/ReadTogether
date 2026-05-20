package com.readtogether.backend.book.dto;

import com.readtogether.backend.book.Book;

import java.time.Instant;

public record BookResponse(
        String id,
        String title,
        String author,
        String category,
        String coverUrl,
        String description,
        String contentText,
        int totalPages,
        String sourceFilename,
        Instant createdAt
) {
    public static BookResponse from(Book book) {
        return new BookResponse(
                "uploaded-" + book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getCategory(),
                book.getCoverUrl(),
                book.getDescription(),
                book.getContentText(),
                book.getTotalPages(),
                book.getSourceFilename(),
                book.getCreatedAt()
        );
    }
}
