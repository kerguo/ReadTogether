package com.readtogether.backend.vocabulary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.readtogether.backend.auth.dto.LoginRequest;
import com.readtogether.backend.auth.dto.RegisterRequest;
import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class VocabularyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void storesVocabularyEntriesForCurrentUserAndBook() throws Exception {
        assertVocabularySchemaUsesUserId();
        String token = registerVerifyAndLogin("vocabulary-reader@example.com", "Vocabulary Reader");

        mockMvc.perform(post("/api/books/1/vocabulary")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.createObjectNode()
                                .put("word", "lark")
                                .put("context", "But you'll have to be up with the lark.")
                                .toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookId").value("1"))
                .andExpect(jsonPath("$.userEmail").value("vocabulary-reader@example.com"))
                .andExpect(jsonPath("$.word").value("lark"))
                .andExpect(jsonPath("$.context").value("But you'll have to be up with the lark."))
                .andExpect(jsonPath("$.createdAt").isString());

        mockMvc.perform(get("/api/books/1/vocabulary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].word").value("lark"));

        mockMvc.perform(get("/api/books/2/vocabulary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/vocabulary")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].word").value("lark"));
    }

    @Test
    void requiresAuthenticationForVocabularyEntries() throws Exception {
        mockMvc.perform(post("/api/books/1/vocabulary")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.createObjectNode()
                                .put("word", "lark")
                                .put("context", "context")
                                .toString()))
                .andExpect(status().isForbidden());
    }

    private void assertVocabularySchemaUsesUserId() {
        List<String> columns = jdbcTemplate.query("PRAGMA table_info(vocabulary_entries)",
                (rs, rowNum) -> rs.getString("name"));
        assertThat(columns).contains("user_id");
        assertThat(columns).doesNotContain("user_email");
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
