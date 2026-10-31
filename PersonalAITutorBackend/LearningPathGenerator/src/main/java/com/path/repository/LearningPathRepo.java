package com.path.repository;

import com.path.entity.LearningPath;
import org.apache.el.stream.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LearningPathRepo extends JpaRepository<LearningPath, Long> {
    List<LearningPath> findByUserId(UUID userId);
    List<LearningPath> findAllByOrderByCreatedAtDesc();
}

