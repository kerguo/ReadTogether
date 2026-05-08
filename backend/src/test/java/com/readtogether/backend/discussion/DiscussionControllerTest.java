package com.readtogether.backend.discussion;

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
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DiscussionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Test
    void storesDiscussionMessagesByBook() throws Exception {
        String token = registerVerifyAndLogin("discussion-reader@example.com", "Discussion Reader");

        mockMvc.perform(get("/api/books/1/discussion/messages")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(post("/api/books/1/discussion/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.createObjectNode()
                                .put("text", "This passage changes how I read the room.")
                                .toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookId").value("1"))
                .andExpect(jsonPath("$.authorEmail").value("discussion-reader@example.com"))
                .andExpect(jsonPath("$.authorName").value("Discussion Reader"))
                .andExpect(jsonPath("$.text").value("This passage changes how I read the room."))
                .andExpect(jsonPath("$.createdAt").isString());

        mockMvc.perform(get("/api/books/1/discussion/messages")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].text").value("This passage changes how I read the room."));

        mockMvc.perform(get("/api/books/2/discussion/messages")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void requiresAuthenticationForDiscussionMessages() throws Exception {
        mockMvc.perform(post("/api/books/1/discussion/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.createObjectNode()
                                .put("text", "Unauthorized message")
                                .toString()))
                .andExpect(status().isForbidden());
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
