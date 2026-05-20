package com.readtogether.backend.book;

import com.readtogether.backend.book.dto.BookResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping("/api/books")
    public List<BookResponse> listBooks() {
        return bookService.listBooks();
    }

    @PostMapping("/api/books")
    @ResponseStatus(HttpStatus.CREATED)
    public BookResponse uploadBook(
            @RequestParam String title,
            @RequestParam(required = false) String author,
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        return bookService.uploadPdfBook(authentication.getName(), title, author, file);
    }
}
