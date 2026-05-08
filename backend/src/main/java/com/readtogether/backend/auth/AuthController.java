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
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/verify-email")
    public AuthResponse verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return authService.verifyEmail(request);
    }

    @PostMapping("/resend-verification")
    public RegisterResponse resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        return authService.resendVerification(request);
    }

    @PostMapping("/wechat/qr/start")
    public WechatQrStartResponse startWechatQr() {
        return authService.startWechatQr();
    }

    @GetMapping("/wechat/qr/status")
    public WechatQrStatusResponse getWechatQrStatus(@RequestParam String sessionId) {
        return authService.getWechatQrStatus(sessionId);
    }

    @PostMapping("/wechat/qr/mock-confirm")
    public WechatQrStatusResponse mockConfirmWechat(@Valid @RequestBody WechatMockConfirmRequest request) {
        return authService.mockConfirmWechat(request);
    }

    @GetMapping(value = "/wechat/qr/mock-scan", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> mockScanWechat(
            @RequestParam String sessionId,
            @RequestParam(required = false) String wechatOpenId,
            @RequestParam(required = false) String displayName
    ) {
        WechatQrStatusResponse response = authService.mockScanWechat(sessionId, wechatOpenId, displayName);
        if ("EXPIRED".equals(response.status())) {
            return ResponseEntity.ok("""
                    <html><body style="font-family:sans-serif;padding:24px;">
                    <h2>QR code expired</h2>
                    <p>Please refresh the QR code on your desktop and scan again.</p>
                    </body></html>
                    """);
        }
        return ResponseEntity.ok("""
                <html><body style="font-family:sans-serif;padding:24px;">
                <h2>Scan confirmed</h2>
                <p>You can return to desktop; registration/login will continue automatically.</p>
                </body></html>
                """);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        return authService.currentUser(authentication.getName());
    }
}
