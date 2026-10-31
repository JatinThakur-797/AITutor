# PathAI Workspace Memory & Context

This file serves as the persistent memory (context block) for the PathAI project. It details the system architecture, code maps, tech stack decisions, current status, and instructions for future AI model invocations to maintain continuity.

---

## 1. System Map & Architecture

### Tech Stack
* **Frontend**: React (Vite-powered SPA), TailwindCSS v4 (using `@tailwindcss/vite` plugin and custom variables in `index.css`), React Router DOM, Axios Client.
* **Backend**: Spring Boot microservice mesh (Java 17/21), Spring Cloud Gateway, Eureka Service Registry, Spring Data JPA, Spring AI.
* **Database**: MySQL relational engines:
  * `user_auth` database (managed by `User-Service`).
  * `ai_tutor` database (managed by `LearningPathGenerator`).

### Project Layout
```
PersonalAITurtorProject/
├── PersonalAITutorBackend/
│   ├── ApiGateway/              # Port 5050: Route Gateway & CORS Coordinator
│   ├── ServiceRegistry/         # Port 8761: Eureka Discovery Registry
│   ├── User-Service/            # Port 8081: JWT Auth, Token Rotation, Google/Github OAuth2
│   ├── AIService/               # Port 8083: LLM prompt executor (Llama-3.3-70b via Groq)
│   └── LearningPathGenerator/   # Port 8082: Goal tracker, Quizzes, Roadmaps, JIT Lesson Service
│
└── PersonalAITutorFrontend/     # Port 5173: React SPA
    ├── src/
    │   ├── api/                 # Axios clients (axiosClient.jsx, tutorApi.jsx)
    │   ├── auth/                # AuthContext.jsx state hook provider
    │   ├── components/tutor/    # Pipeline components (InputPhase, QuizPhase, FeasibilityPhase, RoadmapPhase, LessonPhase, TaskPhase)
    │   └── pages/               # Landing, Login, Signup, Success, Error, UserDashboard, AIDashBoard
```

---

## 2. Tech Stack Decisions & Design Patterns

* **Replit Matte Charcoal Aesthetic**: Strict visual constraint using `#0e1117` main backgrounds, `#1c1e26` panel cards, `#2e303e` crisp borders, neon cyan `#00f0ff` details, electric blue `#0f62fe` primary buttons, sharp corners (`4px-6px`), and Inter/Geist Mono typography.
* **SPA Route Transitions**: Avoid full-browser redirects (`window.location.href`) in client navigation. Always use React Router's `<Link>` and `useNavigate()` to preserve auth state and memory variables.
* **JIT (Just-In-Time) Lesson Generation**: Days and main topics are mapped out during roadmap creation. Individual lesson markdown and assessments are generated and cached in the DB only when the user clicks "Start Interactive Lesson".
* **State Preservation (ReactMarkdown)**: When custom components (like `<MermaidViewer>` or code highlighters) are declared inside `ReactMarkdown`, they must be memoized using `useMemo` to keep structural references static. This prevents React from unmounting and flickering diagrams during scroll events.

---

## 3. Current State & Progress Track

### Completed Features
- [x] Replit developer visual theme overhaul on all pages.
- [x] SPA home landing page at `/` with login/signup link states.
- [x] 10-Question progressive Diagnostic Quiz with score metrics and assigned difficulty baselines.
- [x] AI Feasibility Timeline Checker correcting self-report vs score discrepancies.
- [x] Day-by-Day roadmap timeline tracking completion states and locks.
- [x] Split-layout lesson reader featuring a Table of Contents sidebar, markdown rendering, syntax highlighting, and auto-scrolling to the top.
- [x] Floating, toggleable inline AI Chat Mentor on the lesson page.

### In Progress & Known Gaps
- [ ] **Monaco IDE Playground**: `CodeEditor.jsx` component exists but is a standalone wrapper. It needs integration into the assessment screen (`TaskPhase.jsx`) for practice tasks.
- [ ] **Multi-Goal Roadmap Inconsistency**: Endpoints in `LearningPathGenerator`'s `AIController.java` query for the latest user goal rather than receiving target `goalId`. Must align paths to prevent data overlapping.
- [ ] **Destructive Semicolon Strip**: `.replaceAll(";", "")` inside `AIService.java` (Lesson generation) strips semicolons from code snippets. Needs a safe Markdown syntax parser.
- [ ] **Token Service NPE**: Token rotation service in `User-Service` throws NullPointerException if a token refresh is initiated without a valid refresh cookie.

---

## 4. Continuity Instructions

> [!IMPORTANT]
> **Whenever I start a session and say: `"Read brain.md and resume"`, you MUST:**
> 1. Read this [brain.md](file:///C:/Users/mayan/DevloperCompleteFolder/Projects/PersonalAITurtorProject/brain.md) file immediately to load all context.
> 2. Output a brief 2-3 sentence acknowledgment verifying that you have read the memory.
> 3. State what the immediate active task is.
> 4. **WAIT for my explicit confirmation** before modifying any files or running commands.
