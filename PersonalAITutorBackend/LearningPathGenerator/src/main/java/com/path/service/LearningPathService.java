package com.path.service;

import com.path.entity.LearningPath;
import com.path.repository.LearningPathRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LearningPathService {

    private final LearningPathRepo repo;

    public List<LearningPath> getAllPaths(UUID userId) {
        return repo.findByUserId(userId);
    }
}