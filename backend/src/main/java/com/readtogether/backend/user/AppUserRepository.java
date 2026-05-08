package com.readtogether.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<AppUser> findByEmailAndEmailVerificationCode(String email, String emailVerificationCode);

    Optional<AppUser> findByWechatOpenId(String wechatOpenId);
}
