package com.readtogether.backend.config;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class UserSchemaMigrationService {

    private final JdbcTemplate jdbcTemplate;
    private volatile boolean ready;

    public UserSchemaMigrationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public synchronized void ensureVerificationColumns() {
        if (ready) {
            return;
        }
        if (!usersTableExists()) {
            return;
        }
        ensureUsersColumn(
                "email_verified",
                "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0"
        );
        ensureUsersColumn(
                "email_verification_code",
                "ALTER TABLE users ADD COLUMN email_verification_code VARCHAR(16)"
        );
        ensureUsersColumn(
                "email_verification_expires_at",
                "ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP"
        );
        ensureUsersColumn(
                "wechat_open_id",
                "ALTER TABLE users ADD COLUMN wechat_open_id VARCHAR(128)"
        );
        ready = true;
    }

    private boolean usersTableExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='users'",
                Integer.class
        );
        return count != null && count > 0;
    }

    private void ensureUsersColumn(String column, String alterSql) {
        if (hasColumn(column)) {
            return;
        }
        jdbcTemplate.execute(alterSql);
    }

    private boolean hasColumn(String column) {
        List<Map<String, Object>> columns = jdbcTemplate.queryForList("PRAGMA table_info(users)");
        return columns.stream()
                .map(it -> it.get("name"))
                .anyMatch(name -> column.equals(name));
    }
}
