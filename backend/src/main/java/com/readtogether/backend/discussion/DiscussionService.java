package com.readtogether.backend.discussion;

import com.readtogether.backend.discussion.dto.DiscussionMessageResponse;
import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DiscussionService {

    private static final String DEFAULT_AUTHOR_AVATAR = "https://i.pravatar.cc/100?u=readtogether-user";

    private final DiscussionMessageRepository discussionMessages;
    private final AppUserRepository users;

    public DiscussionService(DiscussionMessageRepository discussionMessages, AppUserRepository users) {
        this.discussionMessages = discussionMessages;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<DiscussionMessageResponse> listMessages(String bookId) {
        String normalizedBookId = normalizeBookId(bookId);
        return discussionMessages.findByBookIdOrderByCreatedAtAsc(normalizedBookId)
                .stream()
                .map(DiscussionMessageResponse::from)
                .toList();
    }

    @Transactional
    public DiscussionMessageResponse createMessage(String bookId, String authorEmail, String text) {
        String normalizedBookId = normalizeBookId(bookId);
        String trimmedText = text == null ? "" : text.trim();
        if (trimmedText.isBlank()) {
            throw new IllegalArgumentException("Message text is required");
        }

        AppUser user = users.findByEmail(authorEmail)
                .orElseThrow(() -> new IllegalArgumentException("User does not exist"));
        DiscussionMessage message = new DiscussionMessage(
                normalizedBookId,
                user,
                DEFAULT_AUTHOR_AVATAR + "-" + user.getId(),
                trimmedText
        );
        return DiscussionMessageResponse.from(discussionMessages.save(message));
    }

    private String normalizeBookId(String bookId) {
        String normalized = bookId == null ? "" : bookId.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Book id is required");
        }
        return normalized;
    }
}
