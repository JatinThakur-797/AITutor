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
    public String buildLessonPrompt(String mainTopic, List<String> subTopics, String currentLevel, String overallGoal) {
        String subs = String.join(", ", subTopics);
        String subsNumbered = "";
        for (int i = 0; i < subTopics.size(); i++) {
            subsNumbered += (i + 1) + ". " + subTopics.get(i) + "\n";
        }

        return """
You are a Senior Developer writing a premium technical lesson for a %s level student.
 
LEARNING PROGRAM GOAL: %s
TOPIC: %s
SUBTOPICS TO COVER:
%s
 
LESSON REQUIREMENTS:
- Write a highly detailed, comprehensive, and exhaustive markdown lesson covering ALL subtopics as ## headers. The total lesson content MUST be at least 800–1200 words to provide deep coverage.
- The lesson content, all code examples, and all questions MUST be strictly oriented around the user's LEARNING PROGRAM GOAL (%s). If the goal specifies a certain language (e.g. Java, Python, C++, JavaScript), you MUST use that language.
- CRITICAL WARNING: Java and JavaScript are entirely different languages! If the goal is "Java" (or contains "Java"), you MUST write strict Java syntax (e.g., class declarations, typed variables, System.out.println). NEVER use JavaScript syntax (e.g., let, const, var, function, console.log) when the goal is Java.
- Include multiple practical, production-grade code examples with proper syntax, and explain the code lines in detail.
- Ensure the content has enough depth, theory, and exercises to occupy the user's daily study allocation.
- For flow concepts, include a mermaid diagram (use ```mermaid blocks starting with graph TD or flowchart TD)
- Keep it educational, clear, and engaging
 
TASK REQUIREMENTS:
- Create ONE assessment task (type: QUIZ, CODING, or ACTIVITY)
 
RETURN ONLY THIS EXACT JSON STRUCTURE. NO TEXT BEFORE OR AFTER.
The "lesson" value must be a valid JSON string (escape newlines as \\n, quotes as \\"):
 
{
  "lesson": "# %s\\n\\nLesson content here with \\n for newlines...",
  "task": {
    "type": "QUIZ | CODING | ACTIVITY",
    "content": {
      // IF type is QUIZ:
      // "question": "string",
      // "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
      // "correct": "A",
      // "explanation": "string"
      
      // IF type is CODING:
      // "instructions": "string",
      // "starter_code": "string",
      // "expected_output": "string"
      
      // IF type is ACTIVITY:
      // "instructions": "string"
    }
  }
}

- Mermaid diagrams MUST follow strict syntax constraints:
  - ALWAYS start the mermaid block with a declaration (e.g., `graph TD` or `flowchart TD`) on the first line.
  - ALWAYS wrap node text and link text in double quotes ("") to prevent syntax errors.
  - NEVER use unquoted parentheses (), brackets [], or curly braces {} inside node text.
  - ✅ VALID: 
    graph TD
    A["Start Program"] -->|"Read (Input)"| B{"Is Valid?"}
  - ❌ INVALID: 
    A[Start Program] -->|Read (Input)| B{Is Valid?}
  - ALWAYS use standard newline characters (\\n) to separate every node and link.
IMPORTANT:
- The "lesson" field must be a proper JSON string — escape ALL newlines as \\n
- Do NOT use triple backticks around the entire response
- The JSON must be parseable
""".formatted(currentLevel, overallGoal, mainTopic, subsNumbered, overallGoal, mainTopic);
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