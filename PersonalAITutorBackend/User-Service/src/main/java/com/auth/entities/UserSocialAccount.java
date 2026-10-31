package com.auth.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_social_account")
@Data
@NoArgsConstructor
public class UserSocialAccount {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(columnDefinition = "BINARY(16)")
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", columnDefinition = "BINARY(16)")
    private User user;

    private String provider;
    private String providerUserId;
    private String providerEmail;

    private OffsetDateTime createdAt = OffsetDateTime.now();
    private OffsetDateTime lastLogin;
}
