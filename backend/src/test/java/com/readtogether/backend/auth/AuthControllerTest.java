package com.readtogether.backend.auth;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Test
    void requiresEmailVerificationBeforeLogin() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest(
                "reader@example.com",
                "Reader",
                "password123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("reader@example.com"))
                .andExpect(jsonPath("$.message").isString());

        LoginRequest loginRequest = new LoginRequest("reader@example.com", "password123");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Email is not verified"));

        AppUser pendingUser = appUserRepository.findByEmail("reader@example.com")
                .orElseThrow();
        assertThat(pendingUser.getEmailVerificationCode()).isNotBlank();

        String verifyPayload = objectMapper.createObjectNode()
                .put("email", "reader@example.com")
                .put("verificationCode", pendingUser.getEmailVerificationCode())
                .toString();

        String verifyResponse = mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.user.email").value("reader@example.com"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String verifyToken = objectMapper.readTree(verifyResponse).get("accessToken").asText();
        assertThat(verifyToken).isNotBlank();

        String loginResponse = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(loginResponse);
        String loginToken = json.get("accessToken").asText();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + loginToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("reader@example.com"))
                .andExpect(jsonPath("$.displayName").value("Reader"));
    }

    @Test
    void rejectsProtectedEndpointWithoutToken() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isForbidden());
    }

    @Test
    void completesWechatQrRegistrationFlow() throws Exception {
        String startResponse = mockMvc.perform(post("/api/auth/wechat/qr/start")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").isString())
                .andExpect(jsonPath("$.qrCodeUrl").isString())
                .andExpect(jsonPath("$.expiresInSeconds").value(300))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String sessionId = objectMapper.readTree(startResponse).get("sessionId").asText();
        assertThat(sessionId).isNotBlank();

        mockMvc.perform(get("/api/auth/wechat/qr/status")
                        .param("sessionId", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.auth").doesNotExist());

        String wechatOpenId = "wx_test_" + System.currentTimeMillis();
        String confirmPayload = objectMapper.createObjectNode()
                .put("sessionId", sessionId)
                .put("wechatOpenId", wechatOpenId)
                .put("displayName", "Wechat Test User")
                .toString();

        String confirmResponse = mockMvc.perform(post("/api/auth/wechat/qr/mock-confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(confirmPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.auth.accessToken").isString())
                .andExpect(jsonPath("$.auth.user.displayName").value("Wechat Test User"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String token = objectMapper.readTree(confirmResponse)
                .get("auth")
                .get("accessToken")
                .asText();
        assertThat(token).isNotBlank();

        mockMvc.perform(get("/api/auth/wechat/qr/status")
                        .param("sessionId", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.auth.accessToken").isString());

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Wechat Test User"))
                .andExpect(jsonPath("$.email").value("wechat_" + wechatOpenId + "@wechat.local"));
    }
}
