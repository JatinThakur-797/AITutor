package com.path.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "learning_paths")
@Data
public class LearningPath {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // This connects the path to the user!
    @Column(nullable = false)
    private UUID userId;
    // STORES: User's Input
    private String currentSkills;
    private String careerGoal;
    private String learningStyle;     // e.g., "Visual", "Reading"
    private String difficultyLevel;   // e.g., "Beginner", "Advanced"
    private String preferredDuration; // e.g., "2 weeks"

    // STORES: The huge JSON roadmap string returned by AI
    // "LONGTEXT" allows storing very large strings in MySQL
    @Column(columnDefinition = "LONGTEXT")
    private String content;


    private LocalDateTime createdAt = LocalDateTime.now();
}
