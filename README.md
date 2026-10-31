# 🧠 PathAI — Personal AI Tutor

> An intelligent, adaptive learning platform that takes any topic you want to learn, runs a diagnostic assessment, generates a realistic study plan, and teaches it to you with AI-generated interactive lessons — all powered by a Spring Boot microservice backend and a sleek React frontend.

[![Java](https://img.shields.io/badge/Java-17-orange?style=flat-square&logo=openjdk)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.8-brightgreen?style=flat-square&logo=spring)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-purple?style=flat-square&logo=vite)](https://vite.dev/)
[![Groq](https://img.shields.io/badge/LLM-Groq%20%2F%20Llama%203.3-red?style=flat-square)](https://groq.com/)
[![MySQL](https://img.shields.io/badge/Database-MySQL%208-blue?style=flat-square&logo=mysql)](https://mysql.com/)

---

## 📖 What is PathAI?

PathAI is a **full-stack personal AI tutor** that solves the most frustrating problem in self-learning: **you don't know what you don't know, and typical courses are too slow or too fast for your actual skill level.**

PathAI solves this with a 6-phase adaptive pipeline:

1. **Tell it what you want to learn** — any topic, any timeframe
2. **Take a diagnostic quiz** — AI probes your real skill level with 10 targeted questions
3. **Get an honest feasibility check** — AI compares your self-estimate vs. actual skill and corrects your timeline if needed
4. **Follow a personalized roadmap** — structured day-by-day plan locked in sequence
5. **Study with rich interactive lessons** — AI-generated markdown content with diagrams, code examples, and syntax highlighting
6. **Practice with tasks** — hands-on coding exercises with Monaco IDE integration

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        React SPA (Port 5173)                            │
│  Landing → Login/Signup → Dashboard → AI Pipeline (6 Phases)           │
│  TailwindCSS v4 | React Router 7 | Axios + Auto-refresh interceptor     │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTPS / REST
                ┌────────────▼────────────┐
                │      API Gateway        │  Port 5050
                │   Spring Cloud Gateway  │  ← JWT Auth Filter
                │   Redis Session Cache   │  ← CORS (allow-credentials)
                └──┬──────────┬──────┬───┘
                   │          │      │
          ┌────────▼──┐  ┌────▼──┐  ┌▼───────────────────┐
          │User-Service│  │AI-Svc │  │LearningPathGenerator│
          │Port 8080   │  │Pt1010 │  │Port 8085            │
          │            │  │       │  │                     │
          │ JWT Auth   │  │ Groq  │  │ Quiz Engine         │
          │ OAuth2     │  │ LLM   │  │ Feasibility Check   │
          │ (Google,   │  │(Llama │  │ Roadmap Builder     │
          │  GitHub)   │  │ 3.3)  │  │ JIT Lesson Gen      │
          │ MySQL      │  │       │  │ Chat Mentor         │
          │(user_auth) │  │       │  │ MySQL (ai_tutor)    │
          └────────────┘  └───────┘  └──────────┬──────────┘
                                                 │ Feign HTTP
                                            ┌────┘
                                         to AI-Service
                                         (Lesson + Chat)
          ┌──────────────────────────────────────────────────┐
          │              Eureka Service Registry              │
          │                   Port 8761                      │
          │   All services register → Gateway resolves lb:// │
          └──────────────────────────────────────────────────┘
```

---

## 📂 Repository Structure

```
PersonalAITurtorProject/
├── .gitignore                          # Root-level gitignore
├── README.md                           # ← This file (complete overview)
├── brain.md                            # AI model context memory file
│
├── PersonalAITutorBackend/             # Spring Boot microservices
│   ├── .gitignore
│   ├── README.md                       # Backend-specific docs
│   ├── ServiceRegistry/                # Eureka (Port 8761)
│   ├── ApiGateway/                     # Gateway + JWT filter (Port 5050)
│   ├── User-Service/                   # Auth, JWT, OAuth2 (Port 8080)
│   ├── AIService/                      # Groq/LLM integration (Port 1010)
│   └── LearningPathGenerator/          # Core engine (Port 8085)
│
└── PersonalAITutorFrontend/            # React + Vite SPA
    ├── .gitignore
    ├── README.md                       # Frontend-specific docs
    └── src/
        ├── api/                        # Axios clients
        ├── auth/                       # AuthContext
        ├── components/tutor/           # 6-phase pipeline components
        └── pages/                      # Route pages
```

---

## 🚀 The 6-Phase AI Learning Pipeline

### Phase 1 — `InputPhase` — Goal Definition
The user specifies:
- **Learning goal** (e.g., "Learn React in 30 days")
- **Self-rated skill level** (Beginner / Intermediate / Advanced)
- **Available timeframe** (days)

### Phase 2 — `QuizPhase` — Diagnostic Assessment
- AI generates **10 progressive multiple-choice questions** tailored to the stated goal
- Questions increase in difficulty to map where exactly the user's knowledge breaks down
- Score determines the **actual baseline difficulty** for lesson content

### Phase 3 — `FeasibilityPhase` — Timeline Reality Check
- Compares user's **self-reported skill level** vs. **quiz-derived actual level**
- AI generates an honest feasibility report: "Your quiz score suggests beginner level but you said intermediate — adjusting timeline to 45 days"
- Prevents over-ambitious plans that lead to dropout

### Phase 4 — `RoadmapPhase` — Structured Study Plan
- Generates a **day-by-day roadmap** with named topics for each day
- Visual timeline with **progress tracking** and sequential locking (can't skip ahead)
- Day cards show: topic name, completion status, lesson access button

### Phase 5 — `LessonPhase` — Interactive Lesson Reader
- **Split-layout UI**: Table of Contents sidebar + main content panel
- **AI-generated markdown lessons** with:
  - Code blocks with syntax highlighting (react-syntax-highlighter)
  - Mermaid architecture diagrams
  - GFM tables and callouts
- **JIT generation**: Lessons generated and cached on first access, not upfront
- **Floating AI Chat Mentor**: Ask questions scoped to the current lesson topic

### Phase 6 — `TaskPhase` — Hands-On Practice
- Practice task generated alongside the lesson
- Monaco Editor integration for code execution
- Self-assessment to mark day complete

---

## 🛠️ Full Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | Spring Boot 3.5.8 |
| Language | Java 17 |
| Service Mesh | Spring Cloud 2025.0.0 |
| API Gateway | Spring Cloud Gateway |
| Service Discovery | Netflix Eureka |
| AI / LLM | Spring AI 1.1.0 → Groq Cloud |
| LLM Model | Llama 3.3 70B Versatile |
| Auth | JWT (HMAC-SHA256 via jjwt 0.11.5) |
| Social Login | OAuth2 (Google + GitHub) |
| HTTP Client | OpenFeign |
| ORM | Spring Data JPA + Hibernate |
| Database | MySQL 8 (2 schemas) |
| Migrations | Flyway |
| Session Cache | Redis |
| Documentation | SpringDoc OpenAPI (Swagger UI) |
| Build | Apache Maven |
| Utilities | Lombok |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI Framework |
| Vite | 7 | Build tool + HMR dev server |
| TailwindCSS | v4 | Utility-first CSS |
| React Router DOM | 7 | Client-side routing |
| Axios | 1.x | HTTP + interceptor logic |
| React Markdown | 10 | Lesson markdown rendering |
| remark-gfm | 4 | GitHub flavored markdown |
| react-syntax-highlighter | 16 | Code syntax highlighting |
| Mermaid.js | 11 | Architecture diagram rendering |
| Monaco Editor | 4 | Embedded IDE for tasks |
| lucide-react | latest | Icon library |

---

## ⚙️ Setup & Running Locally

### Prerequisites
- **Java 17+** and **Maven 3.8+**
- **Node.js 18+** and **npm**
- **MySQL 8** running on port 3306
- **Redis** running on port 6379
- **Groq API Key** — free at [console.groq.com](https://console.groq.com/)
- **Google OAuth App** credentials
- **GitHub OAuth App** credentials

### 1. Database Setup

```sql
CREATE DATABASE user_auth;
CREATE DATABASE ai_tutor;
```

### 2. Backend Configuration

Each service uses environment variables. The easiest approach is to set them as system environment variables, or pass them with `-D` flags to Maven:

```powershell
# Windows PowerShell — set for current session
$env:MYSQL_PASSWORD = "your_password"
$env:APP_JWT_SECRET = "your_min_32_char_jwt_secret"
$env:OPENAI_API_KEY = "gsk_your_groq_key"
$env:GOOGLE_CLIENT_ID = "your_google_id"
$env:GOOGLE_CLIENT_SECRET = "your_google_secret"
$env:GITHUB_CLIENT_ID = "your_github_id"
$env:GITHUB_CLIENT_SECRET = "your_github_secret"
```

### 3. Start Backend Services (In This Order)

```bash
# Terminal 1 — Eureka Registry (must start first)
cd PersonalAITutorBackend/ServiceRegistry
mvn spring-boot:run

# Terminal 2 — User Service
cd PersonalAITutorBackend/User-Service
mvn spring-boot:run

# Terminal 3 — AI Service
cd PersonalAITutorBackend/AIService
mvn spring-boot:run

# Terminal 4 — Learning Path Generator
cd PersonalAITutorBackend/LearningPathGenerator
mvn spring-boot:run

# Terminal 5 — API Gateway (start last)
cd PersonalAITutorBackend/ApiGateway
mvn spring-boot:run
```

### 4. Start Frontend

```bash
cd PersonalAITutorFrontend
cp .env.example .env.local   # Edit with your values
npm install
npm run dev
# → http://localhost:5173
```

### Service Port Reference

| Service | Port |
|---------|------|
| React Frontend | 5173 |
| API Gateway | 5050 |
| Eureka Dashboard | 8761 |
| User-Service | 8080 |
| AI-Service | 1010 |
| LearningPathGenerator | 8085 |
| Redis | 6379 |
| MySQL | 3306 |

---

## 🔐 Security Architecture

### JWT Strategy
- **Access Token**: Short-lived (100 minutes), stored in `localStorage`, sent via `Authorization: Bearer` header
- **Refresh Token**: Long-lived (30 days), stored in `HttpOnly Secure` cookie (inaccessible to JS)
- **Rotation**: On every refresh call, old refresh token is invalidated and a new pair is issued

### OAuth2 Flow
```
User clicks "Login with Google"
  → Backend redirects to Google auth consent
  → Google returns authorization code to backend callback
  → Backend exchanges code for user profile
  → Backend creates/updates user in MySQL
  → Backend issues own JWT pair
  → Frontend receives token via /auth/success redirect
  → Enters SPA with valid JWT session
```

### API Gateway Auth Filter
Every request through the gateway passes through `AuthenticationFilter`, which:
1. Checks for public routes (login, register, oauth2/**) — bypasses filter
2. Extracts `Authorization: Bearer <token>` header
3. Validates JWT signature using shared secret
4. Rejects with 401 if invalid/expired

---

## 🧩 Engineering Challenges & Solutions

### 1. Stateless JWT Auth Across Microservices
**Challenge**: How do you validate JWTs at the gateway without hitting the User-Service database on every request?

**Solution**: Both the API Gateway and User-Service share the same JWT secret via environment variables. The gateway validates the JWT's HMAC-SHA256 signature locally — no database call, no inter-service roundtrip. Verification is O(1).

### 2. LLM Timeout for Long Lesson Generation (60s+)
**Challenge**: Generating a complete interactive lesson (2000+ tokens) via Groq takes 30-90 seconds. Spring's default Feign and web timeouts are 60 seconds — causing `ReadTimeoutException`.

**Solution**: Configured OpenFeign with `connectTimeout=50000ms` and `readTimeout=600000ms` (10 minutes). This allows the system to handle even the longest possible LLM responses without failing.

### 3. Mermaid Diagram Flicker in ReactMarkdown
**Challenge**: Mermaid diagrams flickered and disappeared on scroll because ReactMarkdown recreated custom component references on every render, causing React to unmount/remount diagram nodes.

**Solution**: All custom ReactMarkdown component maps (`components={...}`) are wrapped in `useMemo()`. This keeps object references stable across re-renders — React reuses the existing DOM nodes instead of unmounting them.

### 4. OAuth2 Token Bridging into SPA Without Full-Page State Loss
**Challenge**: OAuth2 requires a full-page browser redirect to the backend and back. This breaks SPA state, localStorage, and React component state entirely.

**Solution**: The backend OAuth2 success handler redirects to `/auth/success?token=ACCESS_TOKEN&refreshExpiry=...`. The `Success.jsx` page extracts the token from the URL query string, stores it in localStorage, then uses React Router's `useNavigate()` to enter the SPA cleanly — never losing the SPA context.

### 5. Axios Token Refresh Race Condition
**Challenge**: If multiple API calls fire simultaneously when the access token expires, each fires a separate `/auth/refresh` call — the first invalidates the refresh cookie, making all subsequent ones fail.

**Solution**: Added a `_retry` flag to `originalRequest` in the Axios interceptor. Only the first intercepted 401 triggers a refresh; subsequent intercepted errors skip the retry logic and fail cleanly.

### 6. CORS + HttpOnly Cookie + API Gateway Coordination
**Challenge**: The SPA needs to send both a JWT header AND have the browser include the HttpOnly refresh cookie on refresh calls — this requires `withCredentials: true` on the frontend AND explicit `allow-credentials=true` on the gateway.

**Solution**: Configured gateway's CORS `allow-credentials=true`, `exposed-headers=Authorization,Set-Cookie`, and `allowed-origins=http://localhost:5173` (exact origin, not wildcard — required for credentials mode).

---

## 🎯 Current Status

### ✅ Completed Features
- [x] Full authentication system: email/password + Google OAuth2 + GitHub OAuth2
- [x] JWT access + refresh token rotation with HttpOnly cookie
- [x] Full Eureka service registry + Spring Cloud Gateway routing
- [x] AI diagnostic quiz (10 questions, progressive difficulty)
- [x] AI feasibility check with timeline correction
- [x] Day-by-day AI roadmap with sequential unlock system
- [x] JIT AI lesson generation with markdown rendering
- [x] Lesson ToC sidebar with smooth auto-scroll
- [x] Mermaid diagram rendering inside lessons
- [x] Syntax-highlighted code blocks in lessons
- [x] Floating AI chat mentor scoped to lesson context

### 🚧 In Progress / Known Gaps
- [ ] **Monaco IDE Task Integration**: `CodeEditor.jsx` exists but needs wiring into `TaskPhase.jsx`
- [ ] **Multi-Goal Roadmap Isolation**: API endpoints should receive `goalId` explicitly instead of querying "latest goal" — prevents data overlap for users with multiple goals
- [ ] **Semicolon Strip Bug**: `AIService.java` contains `.replaceAll(";", "")` which strips semicolons from code snippets in lessons — needs proper Markdown-aware parsing
- [ ] **Token Refresh NPE**: `User-Service` token rotation throws `NullPointerException` when refresh is called without a valid refresh cookie in the request

---

## 👨‍💻 Author

**Jatin Thakur**
- GitHub: [@JatinThakur-797](https://github.com/JatinThakur-797)
- Project Repository: [AITutor](https://github.com/JatinThakur-797/AITutor)

---

## 📄 License

This project is for personal/educational use. See individual service directories for more details.
