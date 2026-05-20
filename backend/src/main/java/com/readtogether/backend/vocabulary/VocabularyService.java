package com.readtogether.backend.vocabulary;

import com.readtogether.backend.vocabulary.dto.VocabularyEntryResponse;
import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class VocabularyService {

    private final VocabularyEntryRepository vocabularyEntries;
    private final AppUserRepository users;

    public VocabularyService(VocabularyEntryRepository vocabularyEntries, AppUserRepository users) {
        this.vocabularyEntries = vocabularyEntries;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<VocabularyEntryResponse> listUserEntries(String userEmail) {
        AppUser user = findUser(userEmail);
        return vocabularyEntries.findByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(VocabularyEntryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<VocabularyEntryResponse> listBookEntries(String bookId, String userEmail) {
        AppUser user = findUser(userEmail);
        return vocabularyEntries.findByUser_IdAndBookIdOrderByCreatedAtDesc(
                        user.getId(),
                        normalizeBookId(bookId)
                )
                .stream()
                .map(VocabularyEntryResponse::from)
                .toList();
    }

    @Transactional
    public VocabularyEntryResponse createEntry(String bookId, String userEmail, String word, String context) {
        String normalizedBookId = normalizeBookId(bookId);
        AppUser user = findUser(userEmail);
        String trimmedWord = normalizeWord(word);
        String trimmedContext = context == null ? "" : context.trim();

        VocabularyEntry entry = new VocabularyEntry(
                normalizedBookId,
                user,
                trimmedWord,
                trimmedContext
        );
        return VocabularyEntryResponse.from(vocabularyEntries.save(entry));
    }

    private String normalizeBookId(String bookId) {
        String normalized = bookId == null ? "" : bookId.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Book id is required");
        }
        return normalized;
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private AppUser findUser(String email) {
        return users.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("User does not exist"));
    }

    private String normalizeWord(String word) {
        String normalized = word == null ? "" : word.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Word is required");
        }
        return normalized;
    }
}
