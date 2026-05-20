package com.readtogether.backend.book;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
public class PdfBookParser {

    public ParsedPdf parse(MultipartFile file) {
        try (PDDocument document = PDDocument.load(file.getInputStream())) {
            if (document.isEncrypted()) {
                throw new IllegalArgumentException("Encrypted PDFs are not supported");
            }
            String text = new PDFTextStripper()
                    .getText(document)
                    .replace("\f", "")
                    .replace("\r\n", "\n")
                    .replaceAll("[ \\t]+", " ")
                    .replaceAll("\\n{3,}", "\n\n")
                    .trim();
            if (text.isBlank()) {
                throw new IllegalArgumentException("No readable text was found in this PDF");
            }
            return new ParsedPdf(text, document.getNumberOfPages());
        } catch (IOException ex) {
            throw new IllegalArgumentException("Unable to parse PDF file");
        }
    }

    public record ParsedPdf(String text, int pageCount) {
    }
}
