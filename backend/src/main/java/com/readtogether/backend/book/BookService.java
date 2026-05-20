package com.readtogether.backend.book;

import com.readtogether.backend.book.dto.BookResponse;
import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class BookService {

    private static final String DEFAULT_AUTHOR = "Unknown Author";
    private static final String DEFAULT_CATEGORY = "Uploaded Books";

    private final BookRepository books;
    private final AppUserRepository users;
    private final PdfBookParser pdfBookParser;

    public BookService(BookRepository books, AppUserRepository users, PdfBookParser pdfBookParser) {
        this.books = books;
        this.users = users;
        this.pdfBookParser = pdfBookParser;
    }

    public List<BookResponse> listBooks() {
        return books.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(BookResponse::from)
                .toList();
    }

    public BookResponse uploadPdfBook(String userEmail, String title, String author, MultipartFile file) {
        AppUser user = users.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String normalizedTitle = normalizeRequired(title, "Book title is required");
        String normalizedAuthor = normalizeOptional(author, DEFAULT_AUTHOR);
        validatePdf(file);
        PdfBookParser.ParsedPdf parsedPdf = pdfBookParser.parse(file);
        Book saved = books.save(new Book(
                normalizedTitle,
                normalizedAuthor,
                DEFAULT_CATEGORY,
                summaryFor(parsedPdf.text()),
                parsedPdf.text(),
                parsedPdf.pageCount(),
                file.getOriginalFilename() == null ? normalizedTitle + ".pdf" : file.getOriginalFilename(),
                user
        ));
        return BookResponse.from(saved);
    }

    private void validatePdf(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("PDF file is required");
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!filename.endsWith(".pdf") && !contentType.equals("application/pdf")) {
            throw new IllegalArgumentException("Only PDF files can be uploaded");
        }
    }

    private String normalizeRequired(String value, String message) {
        String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptional(String value, String fallback) {
        String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        return normalized.isBlank() ? fallback : normalized;
    }

    private String summaryFor(String text) {
        String normalized = text.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 360) {
            return normalized;
        }
        return normalized.substring(0, 357).trim() + "...";
    }
}
