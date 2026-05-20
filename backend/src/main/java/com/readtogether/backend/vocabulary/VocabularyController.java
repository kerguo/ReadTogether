package com.readtogether.backend.vocabulary;

import com.readtogether.backend.vocabulary.dto.CreateVocabularyEntryRequest;
import com.readtogether.backend.vocabulary.dto.VocabularyEntryResponse;
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
public class VocabularyController {

    private final VocabularyService vocabularyService;

    public VocabularyController(VocabularyService vocabularyService) {
        this.vocabularyService = vocabularyService;
    }

    @GetMapping("/api/vocabulary")
    public List<VocabularyEntryResponse> listUserEntries(Authentication authentication) {
        return vocabularyService.listUserEntries(authentication.getName());
    }

    @GetMapping("/api/books/{bookId}/vocabulary")
    public List<VocabularyEntryResponse> listBookEntries(
            @PathVariable String bookId,
            Authentication authentication
    ) {
        return vocabularyService.listBookEntries(bookId, authentication.getName());
    }

    @PostMapping("/api/books/{bookId}/vocabulary")
    @ResponseStatus(HttpStatus.CREATED)
    public VocabularyEntryResponse createEntry(
            @PathVariable String bookId,
            @Valid @RequestBody CreateVocabularyEntryRequest request,
            Authentication authentication
    ) {
        return vocabularyService.createEntry(bookId, authentication.getName(), request.word(), request.context());
    }
}
