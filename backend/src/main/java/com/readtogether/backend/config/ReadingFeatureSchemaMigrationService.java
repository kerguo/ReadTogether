package com.readtogether.backend.config;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ReadingFeatureSchemaMigrationService {

    private final JdbcTemplate jdbcTemplate;
    private volatile boolean ready;

    public ReadingFeatureSchemaMigrationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public synchronized void ensureUserIdForeignKeys() {
        if (ready) {
            return;
        }
        migrateDiscussionMessages();
        migrateVocabularyEntries();
        ready = true;
    }

    private void migrateDiscussionMessages() {
        if (!tableExists("discussion_messages")) {
            return;
        }
        List<String> columns = columns("discussion_messages");
        if (!columns.contains("user_id") || columns.contains("author_email") || columns.contains("author_name")) {
            boolean hasUserId = columns.contains("user_id");
            boolean hasAuthorEmail = columns.contains("author_email");
            jdbcTemplate.execute("""
                    CREATE TABLE discussion_messages_migrated (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        book_id VARCHAR(80) NOT NULL,
                        user_id INTEGER NOT NULL,
                        author_avatar VARCHAR(255) NOT NULL,
                        text VARCHAR(2000) NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        CONSTRAINT fk_discussion_messages_user FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                    """);
            if (hasUserId && hasAuthorEmail) {
                jdbcTemplate.execute("""
                        INSERT INTO discussion_messages_migrated (id, book_id, user_id, author_avatar, text, created_at)
                        SELECT dm.id, dm.book_id, COALESCE(dm.user_id, u.id), dm.author_avatar, dm.text, dm.created_at
                        FROM discussion_messages dm
                        LEFT JOIN users u ON lower(u.email) = lower(dm.author_email)
                        WHERE COALESCE(dm.user_id, u.id) IS NOT NULL
                        """);
            } else if (hasUserId) {
                jdbcTemplate.execute("""
                        INSERT INTO discussion_messages_migrated (id, book_id, user_id, author_avatar, text, created_at)
                        SELECT dm.id, dm.book_id, dm.user_id, dm.author_avatar, dm.text, dm.created_at
                        FROM discussion_messages dm
                        WHERE dm.user_id IS NOT NULL
                        """);
            } else if (hasAuthorEmail) {
                jdbcTemplate.execute("""
                        INSERT INTO discussion_messages_migrated (id, book_id, user_id, author_avatar, text, created_at)
                        SELECT dm.id, dm.book_id, u.id, dm.author_avatar, dm.text, dm.created_at
                        FROM discussion_messages dm
                        JOIN users u ON lower(u.email) = lower(dm.author_email)
                        """);
            }
            jdbcTemplate.execute("DROP TABLE discussion_messages");
            jdbcTemplate.execute("ALTER TABLE discussion_messages_migrated RENAME TO discussion_messages");
        }
    }

    private void migrateVocabularyEntries() {
        if (!tableExists("vocabulary_entries")) {
            return;
        }
        List<String> columns = columns("vocabulary_entries");
        if (!columns.contains("user_id") || columns.contains("user_email")) {
            boolean hasUserId = columns.contains("user_id");
            boolean hasUserEmail = columns.contains("user_email");
            jdbcTemplate.execute("""
                    CREATE TABLE vocabulary_entries_migrated (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        book_id VARCHAR(80) NOT NULL,
                        user_id INTEGER NOT NULL,
                        word VARCHAR(120) NOT NULL,
                        context VARCHAR(1000) NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        CONSTRAINT fk_vocabulary_entries_user FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                    """);
            if (hasUserId && hasUserEmail) {
                jdbcTemplate.execute("""
                        INSERT INTO vocabulary_entries_migrated (id, book_id, user_id, word, context, created_at)
                        SELECT ve.id, ve.book_id, COALESCE(ve.user_id, u.id), ve.word, ve.context, ve.created_at
                        FROM vocabulary_entries ve
                        LEFT JOIN users u ON lower(u.email) = lower(ve.user_email)
                        WHERE COALESCE(ve.user_id, u.id) IS NOT NULL
                        """);
            } else if (hasUserId) {
                jdbcTemplate.execute("""
                        INSERT INTO vocabulary_entries_migrated (id, book_id, user_id, word, context, created_at)
                        SELECT ve.id, ve.book_id, ve.user_id, ve.word, ve.context, ve.created_at
                        FROM vocabulary_entries ve
                        WHERE ve.user_id IS NOT NULL
                        """);
            } else if (hasUserEmail) {
                jdbcTemplate.execute("""
                        INSERT INTO vocabulary_entries_migrated (id, book_id, user_id, word, context, created_at)
                        SELECT ve.id, ve.book_id, u.id, ve.word, ve.context, ve.created_at
                        FROM vocabulary_entries ve
                        JOIN users u ON lower(u.email) = lower(ve.user_email)
                        """);
            }
            jdbcTemplate.execute("DROP TABLE vocabulary_entries");
            jdbcTemplate.execute("ALTER TABLE vocabulary_entries_migrated RENAME TO vocabulary_entries");
        }
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name=?",
                Integer.class,
                tableName
        );
        return count != null && count > 0;
    }

    private List<String> columns(String tableName) {
        return jdbcTemplate.queryForList("PRAGMA table_info(" + tableName + ")")
                .stream()
                .map(row -> row.get("name"))
                .map(String::valueOf)
                .toList();
    }
}
