package com.readtogether.backend.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class EmailVerificationSender {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationSender.class);

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String from;
    private final String username;
    private final String password;

    public EmailVerificationSender(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.enabled:true}") boolean enabled,
            @Value("${app.mail.from:}") String from,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password
    ) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.enabled = enabled;
        this.from = from == null ? "" : from.trim();
        this.username = username == null ? "" : username.trim();
        this.password = password == null ? "" : password.trim();
    }

    public void send(String email, String code) {
        if (!enabled) {
            // Test/dev fallback mode for local fast iteration.
            log.info("Email sending disabled. Verification code for {} is {}", email, code);
            return;
        }

        if (username.isBlank() || password.isBlank() || from.isBlank()) {
            throw new IllegalStateException("Mail sender is not configured. Please set MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM.");
        }
        if (mailSender == null) {
            throw new IllegalStateException("Mail sender bean is unavailable. Please check spring-boot-starter-mail configuration.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("ReadTogether verification code");
        message.setText(buildBody(code));

        try {
            mailSender.send(message);
        } catch (MailException ex) {
            throw new IllegalStateException("Failed to send verification email. Please verify SMTP settings.", ex);
        }
    }

    private String buildBody(String code) {
        return """
                Welcome to ReadTogether!

                Your verification code is: %s

                This code expires in 10 minutes.
                """.formatted(code);
    }
}
