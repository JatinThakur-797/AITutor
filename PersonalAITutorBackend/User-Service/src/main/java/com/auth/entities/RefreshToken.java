package com.auth.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.GenericGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;
@Entity
@Table(name = "refresh_token")
@Data
@NoArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(columnDefinition = "BINARY(16)")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", columnDefinition = "BINARY(16)")
    private User user;

    private String tokenHash;
    private String jwtId;
    private boolean revoked = false;

    private OffsetDateTime issuedAt = OffsetDateTime.now();
    private OffsetDateTime expiresAt;
}

