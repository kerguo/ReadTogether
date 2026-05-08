package com.readtogether.backend.discussion.dto;

import com.readtogether.backend.discussion.DiscussionMessage;

import java.time.Instant;

public record DiscussionMessageResponse(
        Long id,
        String bookId,
        String authorEmail,
        String authorName,
        String authorAvatar,
        String text,
        Instant createdAt
) {
    public static DiscussionMessageResponse from(DiscussionMessage message) {
        return new DiscussionMessageResponse(
                message.getId(),
                message.getBookId(),
                message.getAuthorEmail(),
                message.getAuthorName(),
                message.getAuthorAvatar(),
                message.getText(),
                message.getCreatedAt()
        );
    }
}
