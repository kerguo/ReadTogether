package com.readtogether.backend.book;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.readtogether.backend.auth.dto.LoginRequest;
import com.readtogether.backend.auth.dto.RegisterRequest;
import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.unit.DataSize;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class BookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MultipartProperties multipartProperties;

    @Test
    void usesThreeMegabyteDefaultUploadLimit() {
        assertThat(multipartProperties.getMaxFileSize()).isEqualTo(DataSize.ofMegabytes(3));
        assertThat(multipartProperties.getMaxRequestSize()).isEqualTo(DataSize.ofMegabytes(3));
    }

    @Test
    void uploadsPdfBookAndStoresParsedText() throws Exception {
        assertBookSchemaExists();
        String token = registerVerifyAndLogin("book-uploader@example.com", "Book Uploader");
        MockMultipartFile pdf = new MockMultipartFile(
                "file",
                "lighthouse-notes.pdf",
                "application/pdf",
                pdfBytes("A marked PDF passage for ReadTogether.")
        );

        mockMvc.perform(multipart("/api/books")
                        .file(pdf)
                        .param("title", "Lighthouse Notes")
                        .param("author", "Virginia Woolf")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.title").value("Lighthouse Notes"))
                .andExpect(jsonPath("$.author").value("Virginia Woolf"))
                .andExpect(jsonPath("$.category").value("Uploaded Books"))
                .andExpect(jsonPath("$.contentText").value("A marked PDF passage for ReadTogether."))
                .andExpect(jsonPath("$.totalPages").value(1));

        mockMvc.perform(get("/api/books")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("Lighthouse Notes"));
    }

    @Test
    void rejectsNonPdfUpload() throws Exception {
        String token = registerVerifyAndLogin("book-reject@example.com", "Book Reject");
        MockMultipartFile text = new MockMultipartFile(
                "file",
                "notes.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "Not a PDF".getBytes()
        );

        mockMvc.perform(multipart("/api/books")
                        .file(text)
                        .param("title", "Notes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only PDF files can be uploaded"));
    }

    private void assertBookSchemaExists() {
        List<String> columns = jdbcTemplate.query("PRAGMA table_info(book)",
                (rs, rowNum) -> rs.getString("name"));
        assertThat(columns).contains(
                "id",
                "title",
                "author",
                "category",
                "content_text",
                "total_pages",
                "uploaded_by_user_id"
        );
    }

    private byte[] pdfBytes(String text) throws Exception {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                stream.beginText();
                stream.setFont(PDType1Font.HELVETICA, 12);
                stream.newLineAtOffset(72, 720);
                stream.showText(text);
                stream.endText();
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    private String registerVerifyAndLogin(String email, String displayName) throws Exception {
        RegisterRequest registerRequest = new RegisterRequest(email, displayName, "password123");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        AppUser pendingUser = appUserRepository.findByEmail(email).orElseThrow();
        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.createObjectNode()
                                .put("email", email)
                                .put("verificationCode", pendingUser.getEmailVerificationCode())
                                .toString()))
                .andExpect(status().isOk());

        String loginResponse = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(email, "password123"))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(loginResponse);
        return json.get("accessToken").asText();
    }
}
