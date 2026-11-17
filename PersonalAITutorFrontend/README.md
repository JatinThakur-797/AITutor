# PathAI Frontend

A complete React/Vite frontend for the current PathAI Spring Boot backend. It includes a responsive learning workspace, dark/light themes, authentication, goal onboarding, AI skill quiz, feasibility report, roadmap, lesson reader, coding/activity tasks, and lesson-aware mentor chat.

## Stack

- React 19 + Vite
- React Router
- Axios with access-token attachment and refresh-cookie retry
- Monaco Editor for coding tasks
- React Markdown + GFM for generated technical lessons and mentor answers
- Lucide icons
- Custom responsive CSS design system (dark and light themes)

## 1. Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- Your backend services running and registered in Eureka
- API Gateway reachable from the browser

## 2. Install and run

From this directory:

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

The default API URL is `http://localhost:8080`, matching the current Gateway `server.port` default. Change `VITE_API_BASE_URL` in `.env` when your gateway is hosted elsewhere.

Build the production bundle:

```bash
npm run build
npm run preview
```

## 3. Backend API integration

The frontend uses the routes currently present in the repository:

| Feature | HTTP route |
|---|---|
| Sign up | `POST /api/auth/signup` |
| Login | `POST /api/auth/login` |
| Refresh access token | `POST /api/auth/refresh` (HttpOnly cookie) |
| Logout | `POST /api/auth/logout` |
| Current profile | `GET /api/user/profile` |
| Start skill quiz | `POST /api/path/testSkills` |
| Submit assessment/feasibility | `POST /api/path/feasibility` |
| Generate roadmap chunk | `POST /api/path/roadmap?startDay=1&days=7` |
| List goals | `GET /api/path/goals` |
| Get roadmap days | `GET /api/path/roadmap/{goalId}/days` |
| Get lesson | `GET /api/path/roadmap/{goalId}/day/{dayNumber}/lesson` |
| Complete day | `PATCH /api/path/roadmap/{goalId}/day/{dayNumber}/complete` |
| Mentor chat | `POST /api/path/chat` |

The assessment request uses `goal`, `currentLevel`, `timePerDay`, and `duration` (months). The frontend grades the quiz using the `correct_answer` values returned by the current quiz DTO and sends `{ score, assignedLevel }` to the feasibility endpoint. `assignedLevel` is derived from the score bands: 0–49% Beginner, 50–79% Intermediate, 80–100% Advanced.

## 4. End-to-end application flow

1. Create an account or sign in.
2. Enter a learning goal, current level, daily study time, and duration.
3. Complete the generated multiple-choice skill assessment.
4. Review the feasibility calculation.
5. Generate the first seven roadmap days.
6. Open a day as an article-style lesson.
7. Ask the lesson-aware AI mentor questions.
8. Complete a quiz, coding, or activity task and mark the day complete.
9. Generate additional seven-day roadmap chunks when required.

## 5. Features and current backend boundaries

### Lesson library

The Explore page is a technical-article-style library built from each user's generated roadmap days. The selected lesson is loaded from the existing lesson endpoint. The current backend does not expose a separate public blog catalogue or blog CRUD API, so the frontend does not invent one.

### Coding workspace

CODING tasks open in Monaco Editor with language detection, reset, copy, and local draft saving. The current backend does not expose a code execution or grading endpoint. The UI therefore does not pretend that code can be run; it clearly explains that a sandboxed code-runner service must be added for execution.

### Mentor streaming

The current repository exposes the synchronous `POST /api/path/chat` endpoint. The frontend uses that endpoint by default. An SSE client is included and can be enabled with `VITE_ENABLE_CHAT_STREAMING=true` only after the backend `/api/path/chat/stream` endpoint is implemented, protected, and deployed. The frontend does not assume that an unmerged streaming endpoint already exists.

### Task persistence

Coding drafts and activity notes are stored in the current browser's local storage. The existing backend supports marking a roadmap day complete but does not expose per-task submission/history endpoints.

### OAuth

Google and GitHub sign-in buttons direct the browser to `/oauth2/authorization/google` and `/oauth2/authorization/github` on the configured Gateway. The OAuth success page handles the current backend redirect query parameters and removes the token from the visible URL after storing it.

## 6. Security notes

- Access tokens are stored in local storage to match the current backend's bearer-token API.
- Refresh tokens remain in the backend-managed HttpOnly cookie; JavaScript never reads them.
- API requests include credentials so the refresh cookie can be sent.
- For production, serve the frontend and Gateway over HTTPS and configure the backend refresh cookie as Secure.
- Do not commit `.env` or credentials.

## 7. Important backend assumptions

- Gateway default port is `8080`.
- Gateway CORS allows `http://localhost:5173` in the current local setup. Add the real frontend origin to the deployed Gateway CORS configuration.
- `/api/user/profile` returns an object containing at least `name` and `email` (the frontend tolerates missing fields).
- The AI quiz response includes `quiz[]`, `options`, and `correct_answer` as shown by the current backend DTO.
- The lesson endpoint returns `title`, `subTopics`, `content`, `taskType`, `taskData`, and fallback/degraded flags.

If any backend field name changes, update the normalizer in the relevant page/API module rather than hardcoding data into the UI.
