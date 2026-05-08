package com.readtogether.backend.auth;

import com.readtogether.backend.auth.dto.AuthResponse;
import com.readtogether.backend.auth.dto.LoginRequest;
import com.readtogether.backend.auth.dto.RegisterResponse;
import com.readtogether.backend.auth.dto.ResendVerificationRequest;
import com.readtogether.backend.auth.dto.RegisterRequest;
import com.readtogether.backend.auth.dto.UserResponse;
import com.readtogether.backend.auth.dto.VerifyEmailRequest;
import com.readtogether.backend.auth.dto.WechatMockConfirmRequest;
import com.readtogether.backend.auth.dto.WechatQrStartResponse;
import com.readtogether.backend.auth.dto.WechatQrStatusResponse;
import com.readtogether.backend.config.UserSchemaMigrationService;
import com.readtogether.backend.user.AppUser;
import com.readtogether.backend.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Locale;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {

    private static final int VERIFICATION_CODE_TTL_SECONDS = 10 * 60;
    private static final int VERIFICATION_CODE_DIGITS = 6;
    private static final long WECHAT_QR_TTL_SECONDS = 5 * 60;
    private static final String WECHAT_STATUS_PENDING = "PENDING";
    private static final String WECHAT_STATUS_CONFIRMED = "CONFIRMED";
    private static final String WECHAT_STATUS_EXPIRED = "EXPIRED";

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final EmailVerificationSender emailVerificationSender;
    private final UserSchemaMigrationService userSchemaMigrationService;
    private final String wechatMockScanBaseUrl;
    private final Random random = new Random();
    private final Map<String, WechatQrSession> wechatQrSessions = new ConcurrentHashMap<>();

    public AuthService(
            AppUserRepository users,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            EmailVerificationSender emailVerificationSender,
            UserSchemaMigrationService userSchemaMigrationService,
            @Value("${app.wechat.mock-scan-base-url:http://localhost:8080}") String wechatMockScanBaseUrl
    ) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.emailVerificationSender = emailVerificationSender;
        this.userSchemaMigrationService = userSchemaMigrationService;
        this.wechatMockScanBaseUrl = wechatMockScanBaseUrl == null ? "http://localhost:8080" : wechatMockScanBaseUrl.trim();
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        ensureUserSchema();
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new IllegalArgumentException("Email is already registered");
        }

        AppUser user = new AppUser(
                email,
                request.displayName().trim(),
                passwordEncoder.encode(request.password())
        );
        refreshVerificationCode(user);
        users.save(user);
        return new RegisterResponse(email, "Verification code has been sent to your email");
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        ensureUserSchema();
        String email = normalizeEmail(request.email());
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.password())
        );

        AppUser user = users.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));
        if (!user.isEmailVerified()) {
            throw new IllegalArgumentException("Email is not verified");
        }
        return toAuthResponse(user);
    }

    @Transactional
    public AuthResponse verifyEmail(VerifyEmailRequest request) {
        ensureUserSchema();
        String email = normalizeEmail(request.email());
        String code = request.verificationCode().trim();

        AppUser user = users.findByEmailAndEmailVerificationCode(email, code)
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification code"));

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException("Email is already verified");
        }
        if (user.getEmailVerificationExpiresAt() == null || user.getEmailVerificationExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Verification code has expired");
        }

        user.markEmailVerified();
        users.save(user);
        return toAuthResponse(user);
    }

    @Transactional
    public RegisterResponse resendVerification(ResendVerificationRequest request) {
        ensureUserSchema();
        String email = normalizeEmail(request.email());
        AppUser user = users.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User does not exist"));
        if (user.isEmailVerified()) {
            throw new IllegalArgumentException("Email is already verified");
        }

        refreshVerificationCode(user);
        users.save(user);
        return new RegisterResponse(email, "Verification code has been sent to your email");
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(String email) {
        ensureUserSchema();
        return users.findByEmail(normalizeEmail(email))
                .map(UserResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("User does not exist"));
    }

    public WechatQrStartResponse startWechatQr() {
        ensureUserSchema();
        String sessionId = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(WECHAT_QR_TTL_SECONDS, ChronoUnit.SECONDS);
        wechatQrSessions.put(sessionId, WechatQrSession.pending(expiresAt));
        String normalizedBase = wechatMockScanBaseUrl.endsWith("/")
                ? wechatMockScanBaseUrl.substring(0, wechatMockScanBaseUrl.length() - 1)
                : wechatMockScanBaseUrl;
        String qrTarget = normalizedBase + "/api/auth/wechat/qr/mock-scan?sessionId="
                + URLEncoder.encode(sessionId, StandardCharsets.UTF_8);
        String qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" + qrTarget;
        return new WechatQrStartResponse(sessionId, qrCodeUrl, WECHAT_QR_TTL_SECONDS);
    }

    public WechatQrStatusResponse getWechatQrStatus(String sessionId) {
        ensureUserSchema();
        WechatQrSession session = wechatQrSessions.get(sessionId);
        if (session == null || session.isExpired()) {
            wechatQrSessions.remove(sessionId);
            return new WechatQrStatusResponse(WECHAT_STATUS_EXPIRED, null);
        }
        if (session.authResponse != null) {
            return new WechatQrStatusResponse(WECHAT_STATUS_CONFIRMED, session.authResponse);
        }
        return new WechatQrStatusResponse(WECHAT_STATUS_PENDING, null);
    }

    @Transactional
    public WechatQrStatusResponse mockConfirmWechat(WechatMockConfirmRequest request) {
        ensureUserSchema();
        String sessionId = request.sessionId().trim();
        WechatQrSession session = wechatQrSessions.get(sessionId);
        if (session == null || session.isExpired()) {
            wechatQrSessions.remove(sessionId);
            return new WechatQrStatusResponse(WECHAT_STATUS_EXPIRED, null);
        }

        String wechatOpenId = request.wechatOpenId().trim();
        AppUser user = users.findByWechatOpenId(wechatOpenId).orElseGet(() -> {
            AppUser created = new AppUser(
                    buildWechatEmail(wechatOpenId),
                    request.displayName().trim(),
                    passwordEncoder.encode(UUID.randomUUID().toString())
            );
            created.setEmailVerified(true);
            created.setWechatOpenId(wechatOpenId);
            return users.save(created);
        });

        AuthResponse authResponse = toAuthResponse(user);
        wechatQrSessions.put(sessionId, WechatQrSession.confirmed(session.expiresAt, authResponse));
        return new WechatQrStatusResponse(WECHAT_STATUS_CONFIRMED, authResponse);
    }

    @Transactional
    public WechatQrStatusResponse mockScanWechat(String sessionId, String wechatOpenId, String displayName) {
        String resolvedOpenId = (wechatOpenId == null || wechatOpenId.isBlank())
                ? "wx_scan_" + UUID.randomUUID().toString().replace("-", "")
                : wechatOpenId.trim();
        String resolvedDisplayName = (displayName == null || displayName.isBlank())
                ? "WeChat User"
                : displayName.trim();
        return mockConfirmWechat(new WechatMockConfirmRequest(sessionId, resolvedOpenId, resolvedDisplayName));
    }

    private void ensureUserSchema() {
        userSchemaMigrationService.ensureVerificationColumns();
    }

    private String buildWechatEmail(String wechatOpenId) {
        return "wechat_" + wechatOpenId.toLowerCase(Locale.ROOT) + "@wechat.local";
    }

    private AuthResponse toAuthResponse(AppUser user) {
        return new AuthResponse(
                "Bearer",
                jwtService.generateToken(user.getEmail()),
                jwtService.getExpirationSeconds(),
                UserResponse.from(user)
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private void refreshVerificationCode(AppUser user) {
        String code = generateCode();
        user.setEmailVerification(code, Instant.now().plusSeconds(VERIFICATION_CODE_TTL_SECONDS));
        emailVerificationSender.send(user.getEmail(), code);
    }

    private String generateCode() {
        int bound = (int) Math.pow(10, VERIFICATION_CODE_DIGITS);
        int value = random.nextInt(bound);
        return String.format("%0" + VERIFICATION_CODE_DIGITS + "d", value);
    }

    private static class WechatQrSession {
        private final Instant expiresAt;
        private final AuthResponse authResponse;

        private WechatQrSession(Instant expiresAt, AuthResponse authResponse) {
            this.expiresAt = expiresAt;
            this.authResponse = authResponse;
        }

        static WechatQrSession pending(Instant expiresAt) {
            return new WechatQrSession(expiresAt, null);
        }

        static WechatQrSession confirmed(Instant expiresAt, AuthResponse authResponse) {
            return new WechatQrSession(expiresAt, authResponse);
        }

        boolean isExpired() {
            return expiresAt.isBefore(Instant.now());
        }
    }
}
