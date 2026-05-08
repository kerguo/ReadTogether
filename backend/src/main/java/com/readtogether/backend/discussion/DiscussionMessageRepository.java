package com.readtogether.backend.discussion;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DiscussionMessageRepository extends JpaRepository<DiscussionMessage, Long> {

    List<DiscussionMessage> findByBookIdOrderByCreatedAtAsc(String bookId);
}
