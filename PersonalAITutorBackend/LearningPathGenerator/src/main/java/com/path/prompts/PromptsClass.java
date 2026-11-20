package com.path.prompts;

import com.path.dto.UserRequest;
import com.path.entity.UserGoal;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PromptsClass {

    // ──────────────────────────────────────────────
    // STEP 1: QUIZ PROMPT (Domain-agnostic + short explanations)
    // ──────────────────────────────────────────────
    public String buildQuizPrompt(UserRequest request) {
        String goal = escapeJson(request.getGoal());
        String level = escapeJson(request.getCurrentLevel());

        return """
You are an AI diagnostic tutor assessing a student's current knowledge before generating a personalized learning roadmap.

INPUT DATA:
Goal: %s
Self-reported Level: %s

QUIZ RULES:
1. Tailor every question strictly to the domain and subject of the Goal above.
2. Generate exactly 10 questions.
3. Progressively increase difficulty (questions 1-3 easy, 4-7 medium, 8-10 hard).
4. Cover core fundamentals and practical application required for the goal.
5. Mix conceptual and scenario/practical questions.
6. Multiple choice only — exactly 4 options per question.
7. Exactly one correct answer per question.
8. Include a clear, concise "explanation" (1-2 sentences) explaining WHY the correct answer is right and why common alternatives are wrong.

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
      "concept": "string",
      "explanation": "Short explanation of why A is correct."
    }
  ]
}
""".formatted(goal, level);
    }

    // ──────────────────────────────────────────────
    // STEP 2: FEASIBILITY PROMPT (Domain-agnostic realistic math)
    // ──────────────────────────────────────────────
    public String buildFeasibilityPrompt(UserGoal goal) {
        return """
You are an expert learning strategist and mentor. Be honest and realistic — do NOT be overly optimistic, and adjust your calculations logically based on the domain of the goal and the user's assessed skill level.

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
  - Estimate realistic total study hours required for the specific domain and scope of the Goal (for example, comprehensive career/job-ready mastery from scratch typically requires ~300-450 hours, while narrower skill goals may require ~80-200 hours).
  - If the user's AI-assessed Level is Intermediate, reduce required hours by ~25-35%%; if Advanced, reduce required hours by ~50-60%% because they already master fundamentals.
  - Calculate estimatedDaysRequired = ceil((Estimated Hours Required) / (Daily Study Time)).
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
                escapeJson(goal.getGoal()),
                escapeJson(goal.getCurrentLevel()),
                escapeJson(goal.getAssignedLevel()),
                goal.getTimePerDay(),
                goal.getDuration() * 30
        );
    }

    // ──────────────────────────────────────────────
    // STEP 3: ROADMAP PROMPT (Domain-agnostic proportional pacing — no cramming!)
    // ──────────────────────────────────────────────
    public String buildRoadmapPromptWithMemory(
            UserGoal goal,
            int startDay,
            int numDays,
            List<String> coveredTopics
    ) {
        boolean isFeasible = Boolean.TRUE.equals(goal.getFeasible());
        int estimatedDays = goal.getEstimatedDaysRequired() != null
                ? goal.getEstimatedDaysRequired()
                : goal.getDuration() * 30;
        String expectedOutcome = goal.getExpectedOutcome() != null
                ? goal.getExpectedOutcome()
                : "foundation";

        String covered = (coveredTopics == null || coveredTopics.isEmpty())
                ? "None"
                : "- " + String.join("\n- ", coveredTopics);

        int endDay = startDay + numDays - 1;
        int totalDays = goal.getDuration() * 30;
        int planningHorizon = Math.max(estimatedDays, endDay);

        int phase1End = Math.max(2, (int) Math.round(planningHorizon * 0.15));
        int phase2End = Math.max(phase1End + 2, (int) Math.round(planningHorizon * 0.45));
        int phase3End = Math.max(phase2End + 2, (int) Math.round(planningHorizon * 0.75));

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
- Focus on high-impact core concepts only, keeping each day realistic for %d hours
- Skip obscure edge cases and prioritize practical application
- Do NOT claim full mastery will be achieved
                    """.formatted(goal.getTimePerDay());
            case "MEDIUM" -> """
- Strictly ONE focused topic per day — NEVER cram multiple broad modules into a single day
- Split broad modules across multiple consecutive days so each sub-skill gets proper practice
- Balance concise theory with hands-on applied exercises
                    """;
            default -> """
- Strictly ONE atomic topic per day — NEVER bundle multiple major modules into one day
- Break broad modules across 3-5 consecutive days so fundamentals are mastered before moving forward
- Cover topics deeply with thorough theory, real-world context, and practical drills
                    """;
        };

        String safeGoal = escapeJson(goal.getGoal());

        return """
You are a Senior Curriculum Architect designing a personalized learning roadmap for any subject or discipline.

USER DATA:
Goal: %s
Current Level: %s
AI-Assessed Level: %s
Daily Time: %d hours/day
Available Duration: %d days

FEASIBILITY:
- Is feasible: %s
- Estimated days needed: %d
- Expected outcome: %s

PREVIOUSLY COVERED TOPICS (DO NOT REPEAT):
%s

LEARNING MODE: %s
%s

UNIVERSAL MACRO-PACING & QUALITY RULES (CRITICAL):
1. Spread the curriculum proportionally across the full %d-day estimated horizon — NEVER compress an entire subject into the first 7-14 days:
  - Days 1 to %d (Phase 1 — Foundations & Mental Models): Core terminology, environment/tool setup, foundational building blocks, and simple guided exercises. Zero intermediate or advanced topics yet.
  - Days %d to %d (Phase 2 — Core Mechanics & Structured Practice): Essential techniques, standard workflows, core problem-solving patterns, and small standalone exercises.
  - Days %d to %d (Phase 3 — Applied Ecosystem & Multi-Step Work): Real-world tools/frameworks, multi-step projects, troubleshooting, and integration.
  - Days %d to %d (Phase 4 — Mastery, Optimization & Capstone): Advanced patterns, quality/performance best practices, edge cases, and capstone synthesis.
2. Strict prerequisite order: NEVER schedule a topic on Day N that relies on concepts scheduled for Day N+1 or later.
3. Each day must focus on ONE cohesive, realistic topic achievable in %d hours/day.
4. Sub-topics must be specific and atomic (maximum 2-3 tightly related sub-topics per day).
5. Hours allocation must sum up to %d hours/day.

TASK: Generate roadmap from Day %d to Day %d (exactly %d days).

RETURN ONLY VALID JSON. NO EXTRA TEXT. NO MARKDOWN.

{
  "goal": "%s",
  "start_day": %d,
  "end_day": %d,
  "roadmap": [
    {
      "day": %d,
      "main_topic": "string",
      "sub_topics": ["string", "string"],
      "hours_allocation": {
        "theory": "1 hour",
        "practice": "2 hours"
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
                planningHorizon,
                phase1End,
                phase1End + 1, phase2End,
                phase2End + 1, phase3End,
                phase3End + 1, planningHorizon,
                goal.getTimePerDay(),
                goal.getTimePerDay(),
                startDay,
                endDay,
                numDays,
                safeGoal,
                startDay,
                endDay,
                startDay
        );
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", "");
    }

    // ──────────────────────────────────────────────
    // STEP 4: LESSON PROMPT (Scope-locked + 2 Official Doc Links + valid Mermaid)
    // ──────────────────────────────────────────────
    public String buildLessonPrompt(
            String mainTopic,
            List<String> subTopics,
            String currentLevel,
            String overallGoal
    ) {
        String safeLevel = currentLevel == null ? "Beginner" : currentLevel;
        String safeGoal = overallGoal == null ? "General learning" : overallGoal;
        String safeTopic = mainTopic == null ? "Core Fundamentals" : mainTopic;

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
        You are a master educator and domain practitioner.

        STUDENT LEVEL: %s
        LEARNING GOAL: %s
        MAIN TOPIC: %s

        ALLOWED SUBTOPICS TO COVER TODAY:
        %s

        PART 1 — LESSON

        Write a comprehensive, crystal-clear Markdown lesson tailored strictly to the Learning Goal and Allowed Subtopics above.

        CRITICAL SCOPE, COMPLETENESS & QUALITY RULES:
1. ZERO FUTURE TOPIC LEAKAGE (CRITICAL): Teach and test ONLY the Allowed Subtopics listed above (plus elementary prerequisites strictly implied by them). NEVER introduce unlearned syntax, control structures, or future topics in explanations, examples, or exercises.
2. Cover EVERY supplied subtopic AND every item listed inside parentheses or lists with separate Markdown sub-headings and complete examples.
3. Target approximately 900–1300 words so every concept is explained thoroughly with clear breakdowns, common pitfalls, and concrete, self-contained examples matching the goal's domain/language.
4. Include a "Hands-On Practice Exercises" section at the end of the lesson with 2–3 concrete, self-contained practice exercises that use ONLY the concepts taught in today's lesson, including clear input/output or completion criteria.
5. Include ONE valid Mermaid diagram inside a ```mermaid code fence ONLY when explaining a process flow, decision flow, lifecycle, or system architecture. MERMAID SYNTAX RULE: Wrap every node label in double quotes (e.g., `B{"score >= 90"}` and `C["grade = 'A'"]`) so special characters never break parsing.
6. Do not put the lesson inside JSON. Do not escape Markdown quotes or newlines.
7. Do not write anything outside the `<LESSON>` and `<TASK>` markers.

        PART 2 — ASSESSMENT & OFFICIAL DOCUMENTATION RESOURCES

        Create a practical task that directly tests ONLY the concepts taught in Part 1, AND provide the 2 best official documentation or authoritative study reference URLs for this exact topic.

        Return the complete response using exactly this structure:

        <LESSON>
        # Lesson title

        Write the complete Markdown lesson here.
        </LESSON>

        <TASK>
        {
          "type": "CODING",
          "content": {
            "language": "python",
            "instructions": "Clear problem statement using ONLY concepts taught in today's lesson, with concrete input/output requirements.",
            "starter_code": "# Starter code template matching the exact programming language of the goal",
            "expected_output": "Exact expected output or evaluation criteria",
            "resources": [
              {
                "type": "DOC",
                "title": "Exact Official Documentation Page Title",
                "url": "[https://docs.python.org/3/tutorial/index.html](https://docs.python.org/3/tutorial/index.html)"
              },
              {
                "type": "DOC",
                "title": "Second Authoritative Reference / Guide Title",
                "url": "[https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)"
              }
            ]
          }
        }
        </TASK>

        TASK & RESOURCE RULES:
- TASK must contain one valid JSON object.
- Its type must be QUIZ, CODING, or ACTIVITY.
- For CODING, set `"language"` to the exact lowercase Monaco language identifier matching the Learning Goal (`"python"`, `"java"`, `"javascript"`, `"typescript"`, `"cpp"`, `"c"`, `"sql"`, `"go"`, `"rust"`, etc.).
- In `"resources"`, output ONLY 2 exact, real official documentation or authoritative reference URLs (`"type": "DOC"`).
- NEVER include YouTube URLs, Google search URLs, or guessed video links in `"resources"` (YouTube videos are fetched separately via the YouTube Data API).
- Escape quotation marks and newlines (`\\n`) inside TASK JSON strings properly.
- Do not put Markdown code fences around the complete response.
        """.formatted(
                safeLevel,
                safeGoal,
                safeTopic,
                numberedTopics
        );
    }

    // ──────────────────────────────────────────────
    // STEP 5: LESSON-AWARE MENTOR CHAT PROMPT
    // ──────────────────────────────────────────────
    public String buildChatPrompt(String message, String lessonTitle, String lessonContent) {
        String safeTitle = (lessonTitle != null && !lessonTitle.isBlank()) ? lessonTitle : "Current Lesson";
        String safeContent = (lessonContent != null && !lessonContent.isBlank()) ? lessonContent : "No lesson body provided.";

        return """
You are PathAI Mentor, a clear and supportive study mentor inside a chat panel.

<lesson_context>
Title: %s
Content:
%s
</lesson_context>

Student Question:
%s

Return STRICT JSON ONLY (no ```json fences, no extra text outside JSON) using this schema:
{
  "reply": "Clear, well-spaced explanation in plain English with normal spaces between every word and \\n for paragraphs/lists.",
  "codeLanguage": "",
  "code": "",
  "table": {
    "headers": [],
    "rows": []
  }
}

Strict Rules:
1. Always keep normal spaces between every word in "reply" and table cells (never smash words together).
2. Only include "code" (and set "codeLanguage", e.g., "java") when the student asks for code, an example, debugging, or implementation. Otherwise set "code": "" and "codeLanguage": "".
3. Only include "table" ("headers" and "rows") when the student asks to compare items, summarize differences, or view a structured matrix. Otherwise set "table": {"headers":[],"rows":[]}.
4. Do NOT dump or copy-paste the raw lesson content back to the student.
5. Keep code properly indented with real newlines (\\n) and spaces.
""".formatted(safeTitle, safeContent, message);
    }
}