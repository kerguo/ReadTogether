package com.readtogether.backend.vocabulary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VocabularyEntryRepository extends JpaRepository<VocabularyEntry, Long> {

    List<VocabularyEntry> findByUser_IdOrderByCreatedAtDesc(Long userId);

    List<VocabularyEntry> findByUser_IdAndBookIdOrderByCreatedAtDesc(Long userId, String bookId);
}
