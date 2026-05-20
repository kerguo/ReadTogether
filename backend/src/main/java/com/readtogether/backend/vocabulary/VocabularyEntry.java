package com.readtogether.backend.vocabulary;

import com.readtogether.backend.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "vocabulary_entries")
public class VocabularyEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String bookId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_vocabulary_entries_user"))
    private AppUser user;

    @Column(nullable = false, length = 120)
    private String word;

    @Column(nullable = false, length = 1000)
    private String context;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected VocabularyEntry() {
    }

    public VocabularyEntry(String bookId, AppUser user, String word, String context) {
        this.bookId = bookId;
        this.user = user;
        this.word = word;
        this.context = context;
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getBookId() {
        return bookId;
    }

    public AppUser getUser() {
        return user;
    }

    public String getWord() {
        return word;
    }

    public String getContext() {
        return context;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
