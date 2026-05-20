package com.readtogether.backend.voice;

import com.readtogether.backend.voice.dto.VoiceTokenResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VoiceController {

    private final VoiceService voiceService;

    public VoiceController(VoiceService voiceService) {
        this.voiceService = voiceService;
    }

    @PostMapping("/api/books/{bookId}/voice/token")
    @ResponseStatus(HttpStatus.CREATED)
    public VoiceTokenResponse createVoiceToken(
            @PathVariable String bookId,
            Authentication authentication
    ) {
        return voiceService.createVoiceToken(bookId, authentication.getName());
    }
}
