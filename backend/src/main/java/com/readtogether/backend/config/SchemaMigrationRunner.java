package com.readtogether.backend.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class SchemaMigrationRunner implements ApplicationRunner {

    private final UserSchemaMigrationService userSchemaMigrationService;
    private final ReadingFeatureSchemaMigrationService readingFeatureSchemaMigrationService;

    public SchemaMigrationRunner(
            UserSchemaMigrationService userSchemaMigrationService,
            ReadingFeatureSchemaMigrationService readingFeatureSchemaMigrationService
    ) {
        this.userSchemaMigrationService = userSchemaMigrationService;
        this.readingFeatureSchemaMigrationService = readingFeatureSchemaMigrationService;
    }

    @Override
    public void run(ApplicationArguments args) {
        userSchemaMigrationService.ensureVerificationColumns();
        readingFeatureSchemaMigrationService.ensureUserIdForeignKeys();
    }
}
