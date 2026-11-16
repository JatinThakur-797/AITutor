package com.path.service;

import com.path.entity.LearningPath;
import com.path.repository.LearningPathRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LearningPathService {
    private final LearningPathRepo repo;

    @GetMapping("/all")
    public ResponseEntity<List<LearningPath>> getAllPaths(String userId) {
        return ResponseEntity.ok(repo.findByUserId(UUID.fromString(userId)));
    }
}
