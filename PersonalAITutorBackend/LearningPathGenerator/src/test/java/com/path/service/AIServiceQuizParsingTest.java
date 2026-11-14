package com.path.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.path.dto.QuizResponse;
import com.path.dto.RoadmapResponse;
import com.path.prompts.PromptsClass;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AIServiceQuizParsingTest {

    @Mock
    private AIClient aiClient;

    private AIService aiService;

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper();
        PromptsClass prompts = new PromptsClass();
        aiService = new AIService(aiClient, mapper, prompts);
        aiService.init();
    }

    @Test
    @DisplayName("Options as array [\"Opt 1\", \"Opt 2\"] is normalized to {\"A\": \"Opt 1\", \"B\": \"Opt 2\"}")
    void optionsAsArrayNormalizedToKeyedMap() {
        String jsonWithArrayOptions = """
                {
                  "quiz": [
                    {
                      "question": "What is Java?",
                      "options": ["A high-level programming language", "A brand of coffee beans"],
                      "correctAnswer": "A",
                      "explanation": "Java is an OOP language",
                      "difficulty": "EASY"
                    }
                  ]
                }
                """;

        when(aiClient.generatePath(anyString())).thenReturn(jsonWithArrayOptions);

        QuizResponse response = aiService.generateQuiz("dummy prompt");

        assertNotNull(response);
        assertFalse(Boolean.TRUE.equals(response.getDegraded()));
        assertNotNull(response.getQuiz());
        assertEquals(1, response.getQuiz().size());

        QuizResponse.Question q = response.getQuiz().get(0);
        assertEquals("What is Java?", q.getQuestion());
        assertNotNull(q.getOptions());
        assertEquals("A high-level programming language", q.getOptions().get("A"));
        assertEquals("A brand of coffee beans", q.getOptions().get("B"));
    }

    @Test
    @DisplayName("Single-object roadmap is wrapped into array node")
    void singleObjectRoadmapWrappedIntoArray() {
        String jsonSingleObjectRoadmap = """
                {
                  "roadmap": {
                    "day": 1,
                    "main_topic": "Variables and Data Types",
                    "sub_topics": ["Primitive types", "Reference types"],
                    "daily_goal": "Understand variables",
                    "hours_allocation": {
                      "theory": "1h",
                      "practice": "2h"
                    }
                  }
                }
                """;

        when(aiClient.generatePath(anyString())).thenReturn(jsonSingleObjectRoadmap);

        RoadmapResponse response = aiService.generateRoadmap("dummy prompt");

        assertNotNull(response);
        assertFalse(Boolean.TRUE.equals(response.getDegraded()));
        assertNotNull(response.getRoadmap());
        assertEquals(1, response.getRoadmap().size());
        assertEquals(1, response.getRoadmap().get(0).getDay());
        assertEquals("Variables and Data Types", response.getRoadmap().get(0).getMainTopic());
    }

    @Test
    @DisplayName("Downstream sentinel response yields degraded fallback with degraded: true")
    void downstreamSentinelReturnsDegradedFallback() {
        when(aiClient.generatePath(anyString())).thenReturn(AIClientFallbackFactory.SENTINEL_FALLBACK);

        QuizResponse quiz = aiService.generateQuiz("dummy prompt");

        assertNotNull(quiz);
        assertTrue(Boolean.TRUE.equals(quiz.getDegraded()));
        assertNotNull(quiz.getQuiz());
        assertEquals(3, quiz.getQuiz().size());
        assertEquals("The tutor is briefly unavailable — showing a starter set. Retry in a few seconds.", quiz.getMessage());
    }

    @Test
    @DisplayName("Malformed/corrupted JSON yields degraded fallback instead of throwing 500")
    void malformedJsonYieldsDegradedFallback() {
        when(aiClient.generatePath(anyString())).thenReturn("This is not valid JSON at all { bad syntax");

        assertDoesNotThrow(() -> {
            QuizResponse quiz = aiService.generateQuiz("dummy prompt");
            assertNotNull(quiz);
            assertTrue(Boolean.TRUE.equals(quiz.getDegraded()));
            assertEquals(3, quiz.getQuiz().size());
        });
    }
}
