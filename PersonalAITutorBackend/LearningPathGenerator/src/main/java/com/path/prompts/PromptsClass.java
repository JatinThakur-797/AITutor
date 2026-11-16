package com.path.prompts;

import com.path.dto.UserRequest;
import com.path.entity.UserGoal;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PromptsClass {

    // ──────────────────────────────────────────────
    // STEP 1: QUIZ PROMPT
    // ──────────────────────────────────────────────
    public String buildQuizPrompt(UserRequest request) {
        // Escape quotes in user input to prevent JSON injection
        String goal = escapeJson(request.getGoal());
        String level = escapeJson(request.getCurrentLevel());

        return """
You are an AI technical tutor assessing a student's knowledge before generating a learning roadmap.

INPUT DATA:
Goal: %s
Self-reported Level: %s

QUIZ RULES:
1. Generate exactly 10 questions
2. Progressively increase difficulty (questions 1-3 easy, 4-7 medium, 8-10 hard)
3. Cover fundamentals required for the goal
4. Mix conceptual and practical questions
5. Multiple choice only — exactly 4 options per question
6. Exactly one correct answer per question

RETURN ONLY VALID JSON. NO EXTRA TEXT. NO MARKDOWN.

{
  "goal": "string",
  "level_assessed": "string",
  "quiz": [
    {
      "id": 1,
      "question": "string",
      "difficulty": "easy",
      "options": {
        "A": "string",
        "B": "string",
        "C": "string",
        "D": "string"
      },
      "correct_answer": "A",
      "concept": "string"
    }
  ]
}
""".formatted(goal, level);
    }

    // ──────────────────────────────────────────────
    // STEP 2: FEASIBILITY PROMPT
    // ──────────────────────────────────────────────
    public String buildFeasibilityPrompt(UserGoal goal) {
        return """
You are an expert technical mentor. Be honest and realistic — do NOT be overly optimistic, but adjust your calculations logically based on the user's assessed skill level.

USER DATA:
Goal: %s
Self-reported Level: %s
AI-assessed Level: %s
Daily Study Time: %d hours/day
Available Duration: %d days

EVALUATION LOGIC & RULES:
1. Interpret level discrepancies correctly:
   - If AI-assessed Level is higher than Self-reported Level (e.g., Assessed = Advanced, Self-reported = Beginner): The user has a strong, proven foundation. They will need SIGNIFICANTLY LESS time to complete the roadmap. Target a higher Expected Outcome (e.g., "job-ready").
   - If Self-reported Level is higher than AI-assessed Level (e.g., Self-reported = Advanced, Assessed = Beginner): The user lacks fundamentals and is overconfident. They will need MORE time. Target a lower Expected Outcome.
2. Hours and Duration Calculation:
   - A full-stack developer path from scratch requires ~450 hours.
   - If the user's AI-assessed Level is Advanced, reduce the required hours to ~150-200 hours because they already master fundamentals.
   - Calculate estimatedDaysRequired = (Estimated Hours Required) / (Daily Study Time).
   - If estimatedDaysRequired <= Available Duration, set "isFeasible" to true.

RETURN ONLY VALID JSON. NO EXTRA TEXT. NO MARKDOWN.

{
  "isFeasible": true,
  "estimatedDaysRequired": 180,
  "expectedOutcome": "foundation",
  "reason": "short honest explanation"
}

Note: expectedOutcome must be one of: "foundation", "intermediate", "job-ready" and give short explanation
""".formatted(
                goal.getGoal(),
                goal.getCurrentLevel(),
                goal.getAssignedLevel(),
                goal.getTimePerDay(),
                goal.getDuration() * 30
        );
    }

    // ──────────────────────────────────────────────
    // STEP 3: ROADMAP PROMPT
    // ──────────────────────────────────────────────
    public String buildRoadmapPromptWithMemory(
            UserGoal goal,
            int startDay,
            int numDays,
            List<String> coveredTopics
    ) {
        // Feasibility data is now read FROM the saved entity — no more hardcoding!
        boolean isFeasible = Boolean.TRUE.equals(goal.getFeasible());
        int estimatedDays = goal.getEstimatedDaysRequired() != null
                ? goal.getEstimatedDaysRequired()
                : goal.getDuration() * 30;
        String expectedOutcome = goal.getExpectedOutcome() != null
                ? goal.getExpectedOutcome()
                : "foundation";

        String covered = coveredTopics.isEmpty()
                ? "None"
                : "- " + String.join("\n- ", coveredTopics);

        int endDay = startDay + numDays - 1;
        int totalDays = goal.getDuration() * 30;

        // Compute mode
        String mode;
        if (!isFeasible) {
            mode = "FAST";
        } else if (totalDays <= estimatedDays * 1.2) {
            mode = "MEDIUM";
        } else {
            mode = "NATURAL";
        }

        String modeInstruction = switch (mode) {
            case "FAST" -> """
                    - Combine multiple topics per day
                    - Focus on high-impact concepts only
                    - Skip deep theory, focus on practical usage
                    - Do NOT claim mastery will be achieved
                    """;
            case "MEDIUM" -> """
                    - Cover all important topics
                    - Include moderate practice
                    - Avoid unnecessary depth
                    """;
            default -> """
                    - Cover topics deeply with full theory
                    - Include projects and real-world usage
                    - Ensure strong fundamentals
                    """;
        };

        // Escape goal string for safe JSON embedding
        String safeGoal = escapeJson(goal.getGoal());

        return """
You are a Senior Technical Curriculum Architect.

USER DATA:
Goal: %s
Current Level: %s
AI-Assessed Level: %s
Daily Time: %d hours/day
Total Duration: %d days

FEASIBILITY:
- Is feasible: %s
- Estimated days needed: %d
- Expected outcome: %s

PREVIOUSLY COVERED TOPICS (DO NOT REPEAT):
%s

LEARNING MODE: %s
%s

TASK: Generate roadmap from Day %d to Day %d (exactly %d days).
No repeated topics. Each day must have enough content to fill %d hours.

RETURN ONLY VALID JSON. NO EXTRA TEXT. NO MARKDOWN.

{
  "goal": "%s",
  "start_day": %d,
  "end_day": %d,
  "roadmap": [
    {
      "day": 1,
      "main_topic": "string",
      "sub_topics": ["string", "string"],
      "hours_allocation": {
        "theory": "X hours",
        "practice": "Y hours"
      },
      "daily_goal": "string"
    }
  ]
}
""".formatted(
                safeGoal,
                goal.getCurrentLevel(),
                goal.getAssignedLevel(),
                goal.getTimePerDay(),
                totalDays,
                isFeasible,
                estimatedDays,
                expectedOutcome,
                covered,
                mode,
                modeInstruction,
                startDay,
                endDay,
                numDays,
                goal.getTimePerDay(),
                safeGoal,
                startDay,
                endDay
        );
    }

    // Prevent JSON injection from user input in prompts
    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", "");
    }
    // Add to PromptsClass.java
    public String buildLessonPrompt(
            String mainTopic,
            List<String> subTopics,
            String currentLevel,
            String overallGoal
    ) {
        String safeLevel = currentLevel == null ? "Beginner" : currentLevel;
        String safeGoal = overallGoal == null ? "General programming" : overallGoal;
        String safeTopic = mainTopic == null ? "General Fundamentals" : mainTopic;

        StringBuilder numberedTopics = new StringBuilder();
        if (subTopics != null) {
            for (int i = 0; i < subTopics.size(); i++) {
                numberedTopics.append(i + 1)
                        .append(". ")
                        .append(subTopics.get(i))
                        .append("\n");
            }
        }

        return """
        You are a senior software engineer and technical educator.

        STUDENT LEVEL: %s
        LEARNING GOAL: %s
        MAIN TOPIC: %s

        SUBTOPICS:
        %s

        PART 1 — LESSON

        Write a detailed, practical Markdown lesson for this student.

        Requirements:
        1. Cover every supplied subtopic using Markdown headings.
        2. Target approximately 700–900 words. Prioritize accuracy over length.
        3. Include explanations, practical examples, and code where relevant.
        4. Match all code examples to the learning goal's programming language.
        5. If the goal involves Java, use Java syntax only, not JavaScript.
        6. Explain important code examples.
        7. Include a Mermaid diagram when it genuinely helps explain a flow.
        8. Include practical examples relevant to real software development.
        9. Do not put the lesson inside JSON.
        10. Do not escape Markdown quotes or newlines.
        11. Do not write anything outside the required section markers.

        PART 2 — ASSESSMENT

        Create exactly one useful assessment task:
        QUIZ, CODING, or ACTIVITY.

        Return the complete response using exactly this structure:

        <LESSON>
        # Lesson title

        Write the complete Markdown lesson here.
        </LESSON>

        <TASK>
        {
          "type": "QUIZ",
          "content": {
            "question": "Question text",
            "options": {
              "A": "Option A",
              "B": "Option B",
              "C": "Option C",
              "D": "Option D"
            },
            "correct": "A",
            "explanation": "Explanation"
          }
        }
        </TASK>

        TASK RULES:
        - TASK must contain one valid JSON object.
        - Its type must be QUIZ, CODING, or ACTIVITY.
        - For QUIZ, include question, options, correct, and explanation.
        - For CODING, include instructions, starter_code, and expected_output.
        - For ACTIVITY, include instructions.
        - Escape quotation marks inside TASK JSON strings correctly.
        - Keep TASK JSON compact.
        - Do not put Markdown code fences around the complete response.
        """.formatted(
                safeLevel,
                safeGoal,
                safeTopic,
                numberedTopics
        );
    }

    public String buildChatPrompt(String message, String lessonTitle, String lessonContent) {
        return """
You are an expert technical tutor assisting a student who has questions about the following lesson.

LESSON TITLE: %s
LESSON CONTENT:
%s

STUDENT QUESTION:
%s

INSTRUCTIONS:
1. Provide a highly educational, clear, and direct response addressing the student's question.
2. Ensure any code snippets are strictly matching the programming language and context of the lesson (if the lesson is in Java, use Java; if Python, use Python).
3. Do NOT include any extra JSON formatting in this chat output. Return plain text response (with markdown syntax if helpful for bullet points or code snippets).
""".formatted(lessonTitle, lessonContent, message);
    }
}