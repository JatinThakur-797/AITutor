package com.auth.repository;

import com.auth.entities.UserSocialAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSocialRepository extends JpaRepository<UserSocialAccount, UUID> {
    Optional<UserSocialAccount> findByProviderAndProviderUserId(String provider, String providerUserId);
}
