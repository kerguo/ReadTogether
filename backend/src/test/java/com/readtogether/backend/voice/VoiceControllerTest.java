package com.readtogether.backend.voice;

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

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.voice.enabled=true",
        "app.voice.livekit.url=ws://localhost:7880",
        "app.voice.livekit.api-key=test-api-key",
        "app.voice.livekit.api-secret=test-api-secret-with-enough-length"
})
@AutoConfigureMockMvc
class VoiceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private VoiceService voiceService;

    @Test
    void createsLiveKitTokenForAuthenticatedUser() throws Exception {
        String token = registerVerifyAndLogin("voice-reader@example.com", "Voice Reader");

        String response = mockMvc.perform(post("/api/books/1/voice/token")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.serverUrl").value("ws://localhost:7880"))
                .andExpect(jsonPath("$.roomName").value("book-1"))
                .andExpect(jsonPath("$.participantName").value("Voice Reader"))
                .andExpect(jsonPath("$.participantId").isString())
                .andExpect(jsonPath("$.token").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(response);
        String jwt = json.get("token").asText();
        JsonNode claims = readJwtClaims(jwt);
        assertThat(claims.get("iss").asText()).isEqualTo("test-api-key");
        assertThat(claims.get("name").asText()).isEqualTo("Voice Reader");
        assertThat(claims.get("video").get("room").asText()).isEqualTo("book-1");
        assertThat(claims.get("video").get("roomJoin").asBoolean()).isTrue();
    }

    @Test
    void requiresAuthenticationForVoiceToken() throws Exception {
        mockMvc.perform(post("/api/books/1/voice/token"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsBlankBookId() throws Exception {
        registerVerifyAndLogin("voice-blank-book@example.com", "Voice Blank");

        assertThatThrownBy(() -> voiceService.createVoiceToken(" ", "voice-blank-book@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Book id is required");
    }

    @Test
    void reportsIncompleteLiveKitConfiguration() {
        VoiceService misconfiguredService = new VoiceService(
                appUserRepository,
                true,
                "",
                "test-api-key",
                "test-api-secret-with-enough-length"
        );

        assertThatThrownBy(() -> misconfiguredService.createVoiceToken("1", "voice-reader@example.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LiveKit voice configuration is incomplete");
    }

    private JsonNode readJwtClaims(String jwt) throws Exception {
        String[] parts = jwt.split("\\.");
        assertThat(parts).hasSize(3);
        byte[] decoded = Base64.getUrlDecoder().decode(parts[1]);
        return objectMapper.readTree(new String(decoded, StandardCharsets.UTF_8));
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
