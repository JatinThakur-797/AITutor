# 🖥️ AITutor Frontend — React + Vite SPA

> The frontend for **PathAI / AITutor** is a modern, dark-themed Single Page Application (SPA) built with **React 19** and **Vite 7**. It guides users through a fully interactive AI-powered learning pipeline — from skill assessment to lesson completion.

---

## 🎨 Design System

The entire UI follows a **Replit Matte Charcoal** developer aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0e1117` | Page backgrounds |
| Panel | `#1c1e26` | Cards, modals |
| Border | `#2e303e` | Dividers, outlines |
| Accent Cyan | `#00f0ff` | Highlights, icons |
| Primary Button | `#0f62fe` | CTAs |
| Typography | Inter + Geist Mono | Body + code |

---

## 📁 Project Structure

```
PersonalAITutorFrontend/
├── public/                    # Static assets
├── src/
│   ├── api/
│   │   ├── axiosClient.jsx    # Axios instance + auto token refresh interceptor
│   │   ├── authApi.jsx        # Login, signup, logout API calls
│   │   ├── pathApi.jsx        # Learning path API calls
│   │   └── tutorApi.jsx       # Quiz, feasibility, roadmap, lesson, chat APIs
│   ├── auth/
│   │   └── AuthContext.jsx    # Global auth state (user, token, isLoggedIn)
│   ├── components/
│   │   ├── ProtectedRoute.jsx # Route guard: redirects to /login if unauthenticated
│   │   ├── CodeEditor.jsx     # Monaco Editor wrapper (task/practice integration)
│   │   └── tutor/             # The 6-phase AI pipeline components
│   │       ├── InputPhase.jsx      # Goal, timeline, self-rating input form
│   │       ├── QuizPhase.jsx       # 10-question progressive diagnostic quiz
│   │       ├── FeasibilityPhase.jsx # AI timeline correction & gap analysis
│   │       ├── RoadmapPhase.jsx    # Day-by-day visual roadmap with lock system
│   │       ├── LessonPhase.jsx     # Split-layout lesson reader + AI chat mentor
│   │       ├── TaskPhase.jsx       # Practice task display (Monaco IDE integration)
│   │       └── MermaidViewer.jsx   # Mermaid diagram renderer (memoized)
│   ├── pages/
│   │   ├── Landing.jsx        # Public home page with feature showcase
│   │   ├── Login.jsx          # Email/password + OAuth2 (Google, GitHub) login
│   │   ├── Signup.jsx         # User registration page
│   │   ├── Dashboard.jsx      # User's learning dashboard / goal overview
│   │   ├── AIDashBoard.jsx    # AI tutoring pipeline controller (phase state machine)
│   │   ├── UserDashboard.jsx  # Detailed user progress view
│   │   ├── Success.jsx        # OAuth2 success redirect handler
│   │   └── Error.jsx          # OAuth2 error / generic error page
│   ├── App.jsx                # Root router with all routes defined
│   ├── main.jsx               # React DOM entry point
│   ├── index.css              # Global design tokens + Tailwind CSS v4 base
│   └── App.css                # App-level layout styles
├── .env.example               # Environment variable template
├── vite.config.js
├── eslint.config.js
└── package.json
```

---

## 🔄 Application Flow — The 6-Phase AI Pipeline

```
User Enters Goal (/ai)
        │
        ▼
┌──────────────┐
│  InputPhase  │  User enters: learning goal, timeframe, self-rated skill level
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  QuizPhase   │  10 progressive MCQ diagnostic quiz → scores expertise baseline
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│  FeasibilityPhase   │  AI compares self-report vs quiz score → corrects timeline
└──────┬──────────────┘
       │
       ▼
┌───────────────┐
│ RoadmapPhase  │  Day-by-day locked roadmap, tracks completion states
└──────┬────────┘
       │ (Click "Start Lesson")
       ▼
┌───────────────┐
│  LessonPhase  │  Split-layout: ToC sidebar + Markdown content + AI Chat Mentor
└──────┬────────┘
       │
       ▼
┌──────────────┐
│  TaskPhase   │  Practice task + Monaco IDE playground
└──────────────┘
```

---

## ⚡ Key Technical Features

### Auto Token Refresh Interceptor
`axiosClient.jsx` implements an Axios response interceptor that:
1. Catches `401 Unauthorized` responses
2. Automatically calls `/api/auth/refresh` using the HttpOnly cookie
3. Retries the original request with the new access token
4. Redirects to `/login` only if refresh also fails

### Memoized Diagram Components
`MermaidViewer.jsx` and custom ReactMarkdown renderers are wrapped in `useMemo()` to prevent React from unmounting/remounting Mermaid diagrams during scroll events — eliminating the diagram flicker bug.

### SPA Navigation Preservation
All routing uses React Router's `useNavigate()` and `<Link>` — never `window.location.href` — to preserve auth state and avoid unnecessary token loss during navigation.

### JIT (Just-In-Time) Lesson Loading
Lessons are NOT pre-generated. The frontend triggers lesson generation on first access via `getLessonContent()`, which signals the backend to generate + cache the lesson. Subsequent visits retrieve from DB.

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI Framework |
| Vite | 7 | Build Tool + Dev Server |
| TailwindCSS | v4 (via @tailwindcss/vite) | Utility CSS |
| React Router DOM | 7 | SPA Routing |
| Axios | 1.x | HTTP Client |
| React Markdown | 10 | Lesson content rendering |
| remark-gfm | 4 | GitHub Flavored Markdown |
| react-syntax-highlighter | 16 | Code block syntax highlighting |
| mermaid | 11 | Diagram rendering |
| @monaco-editor/react | 4 | Code IDE (Monaco) |
| lucide-react | Latest | Icon library |

---

## ⚙️ Setup & Configuration

### Prerequisites
- Node.js 18+ and npm
- Backend services running (see backend README)

### Installation

```bash
cd PersonalAITutorFrontend
npm install
```

### Environment Variables

Copy the template and set your values:

```bash
cp .env.example .env.local
```

```env
# .env.local
VITE_API_BASE_URL=http://localhost:5050
```

### Running the Dev Server

```bash
npm run dev
# App available at http://localhost:5173
```

### Building for Production

```bash
npm run build
# Output in dist/
```

---

## 🧩 Challenges Solved

### 1. Infinite Re-render on ReactMarkdown with Custom Components
Defining custom components (like `<MermaidViewer>`) inline inside `ReactMarkdown` caused React to treat them as new references on every render, unmounting and remounting diagram DOM nodes during scroll. **Fix**: Memoize component maps with `useMemo()`.

### 2. JWT Access Token Auto-Refresh Without UX Disruption
Any API call could fail mid-session with a 401 when the access token expires (100 min). Rather than logging the user out, `axiosClient.jsx` silently refreshes using the HttpOnly cookie and retries — completely transparent to the user.

### 3. OAuth2 Redirect Flow in SPA Context
Social login (Google/GitHub) performs a full-page redirect to the backend, which then redirects to `/auth/success?token=xxx`. The `Success.jsx` page extracts the JWT from query params, stores it in `localStorage`, and uses `useNavigate()` to enter the SPA — preserving the single-page app context.

### 4. Phase State Machine in AIDashboard
The AI tutoring pipeline has 6 distinct phases each with different state requirements. Implemented as a numbered phase state with centralized state storage in `AIDashBoard.jsx`, passing data down to child phase components via props — avoiding excessive context or Redux complexity.
