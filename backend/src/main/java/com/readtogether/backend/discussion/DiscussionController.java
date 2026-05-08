package com.readtogether.backend.discussion;

import com.readtogether.backend.discussion.dto.CreateDiscussionMessageRequest;
import com.readtogether.backend.discussion.dto.DiscussionMessageResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/books/{bookId}/discussion/messages")
public class DiscussionController {

    private final DiscussionService discussionService;

    public DiscussionController(DiscussionService discussionService) {
        this.discussionService = discussionService;
    }

    @GetMapping
    public List<DiscussionMessageResponse> listMessages(@PathVariable String bookId) {
        return discussionService.listMessages(bookId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiscussionMessageResponse createMessage(
            @PathVariable String bookId,
            @Valid @RequestBody CreateDiscussionMessageRequest request,
            Authentication authentication
    ) {
        return discussionService.createMessage(bookId, authentication.getName(), request.text());
    }
}
