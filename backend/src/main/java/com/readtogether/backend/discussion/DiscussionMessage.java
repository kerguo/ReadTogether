package com.readtogether.backend.discussion;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "discussion_messages")
public class DiscussionMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String bookId;

    @Column(nullable = false, length = 254)
    private String authorEmail;

    @Column(nullable = false, length = 120)
    private String authorName;

    @Column(nullable = false)
    private String authorAvatar;

    @Column(nullable = false, length = 2000)
    private String text;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected DiscussionMessage() {
    }

    public DiscussionMessage(String bookId, String authorEmail, String authorName, String authorAvatar, String text) {
        this.bookId = bookId;
        this.authorEmail = authorEmail;
        this.authorName = authorName;
        this.authorAvatar = authorAvatar;
        this.text = text;
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

    public String getAuthorEmail() {
        return authorEmail;
    }

    public String getAuthorName() {
        return authorName;
    }

    public String getAuthorAvatar() {
        return authorAvatar;
    }

    public String getText() {
        return text;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
