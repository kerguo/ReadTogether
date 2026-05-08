package com.readtogether.backend.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class SchemaMigrationRunner implements ApplicationRunner {

    private final UserSchemaMigrationService userSchemaMigrationService;

    public SchemaMigrationRunner(UserSchemaMigrationService userSchemaMigrationService) {
        this.userSchemaMigrationService = userSchemaMigrationService;
    }

    @Override
    public void run(ApplicationArguments args) {
        userSchemaMigrationService.ensureVerificationColumns();
    }
}
