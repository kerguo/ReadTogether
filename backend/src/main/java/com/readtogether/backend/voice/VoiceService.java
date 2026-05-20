package com.readtogether.backend.voice;

import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import com.readtogether.backend.voice.dto.VoiceTokenResponse;
import io.livekit.server.AccessToken;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class VoiceService {

    private final AppUserRepository users;
    private final boolean enabled;
    private final String livekitUrl;
    private final String apiKey;
    private final String apiSecret;

    public VoiceService(
            AppUserRepository users,
            @Value("${app.voice.enabled:false}") boolean enabled,
            @Value("${app.voice.livekit.url:}") String livekitUrl,
            @Value("${app.voice.livekit.api-key:}") String apiKey,
            @Value("${app.voice.livekit.api-secret:}") String apiSecret
    ) {
        this.users = users;
        this.enabled = enabled;
        this.livekitUrl = livekitUrl == null ? "" : livekitUrl.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.apiSecret = apiSecret == null ? "" : apiSecret.trim();
    }

    public VoiceTokenResponse createVoiceToken(String bookId, String userEmail) {
        ensureEnabledAndConfigured();
        String normalizedBookId = normalizeBookId(bookId);
        AppUser user = users.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User does not exist"));

        String roomName = "book-" + normalizedBookId;
        String participantId = "user-" + user.getId();
        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setIdentity(participantId);
        token.setName(user.getDisplayName());
        token.addGrants(new RoomJoin(true), new RoomName(roomName));

        return new VoiceTokenResponse(
                livekitUrl,
                token.toJwt(),
                roomName,
                user.getDisplayName(),
                participantId
        );
    }

    private void ensureEnabledAndConfigured() {
        if (!enabled) {
            throw new IllegalStateException("Voice rooms are not enabled");
        }
        if (livekitUrl.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new IllegalStateException("LiveKit voice configuration is incomplete");
        }
    }

    private String normalizeBookId(String bookId) {
        String normalized = bookId == null ? "" : bookId.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Book id is required");
        }
        return normalized;
    }
}
