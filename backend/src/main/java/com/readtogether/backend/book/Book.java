package com.readtogether.backend.book;

import com.readtogether.backend.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "book")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 120)
    private String author;

    @Column(nullable = false, length = 80)
    private String category;

    @Column(name = "cover_url", length = 1000)
    private String coverUrl;

    @Column(length = 1000)
    private String description;

    @Lob
    @Column(name = "content_text", nullable = false)
    private String contentText;

    @Column(name = "total_pages", nullable = false)
    private int totalPages;

    @Column(name = "source_filename", nullable = false, length = 255)
    private String sourceFilename;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by_user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_book_uploaded_by_user"))
    private AppUser uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Book() {
    }

    public Book(
            String title,
            String author,
            String category,
            String description,
            String contentText,
            int totalPages,
            String sourceFilename,
            AppUser uploadedBy
    ) {
        this.title = title;
        this.author = author;
        this.category = category;
        this.description = description;
        this.contentText = contentText;
        this.totalPages = totalPages;
        this.sourceFilename = sourceFilename;
        this.uploadedBy = uploadedBy;
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

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public String getCategory() {
        return category;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public String getDescription() {
        return description;
    }

    public String getContentText() {
        return contentText;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public String getSourceFilename() {
        return sourceFilename;
    }

    public AppUser getUploadedBy() {
        return uploadedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
