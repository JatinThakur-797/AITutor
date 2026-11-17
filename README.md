# PathAI — AI-Powered Personal Learning Platform

PathAI is a full-stack learning platform that turns a learner's goal into a structured, personalized study journey. A learner defines what they want to learn, completes an AI-generated diagnostic assessment, reviews a feasibility report, follows a day-by-day roadmap, studies generated lessons, completes practice tasks, and asks an AI mentor questions about the current lesson.

The repository contains a React/Vite single-page application and a Spring Boot microservice backend. The browser communicates with the backend through the Spring Cloud API Gateway.

## Product workflow

1. **Create an account or sign in** with email/password, Google, or GitHub.
2. **Define a learning goal** by entering the topic, current level, daily study time, and target duration.
3. **Complete a diagnostic quiz** generated for that learning goal.
4. **Review feasibility** based on the assessment score and assigned level.
5. **Generate a roadmap** in day-based chunks. The current frontend requests the first seven days and can request later chunks through the same endpoint.
6. **Read a generated lesson** with topic sections and Markdown-rendered content.
7. **Practice** using a quiz, a coding editor, or a written activity.
8. **Track completion** by marking a roadmap day complete.
9. **Ask the AI mentor** for help using the current lesson as context. Both synchronous chat and an SSE streaming endpoint are available in the codebase.

## Main capabilities

- Personalized goal onboarding and diagnostic skill assessment.
- AI feasibility feedback and day-by-day roadmap generation.
- On-demand lesson generation and article-style lesson reading.
- Roadmap progress and day-completion tracking.
- Lesson-level quiz, coding, and activity tasks.
- Monaco-based coding editor with local draft saving, reset, and copy actions.
- Lesson-aware AI mentor with synchronous and optional streaming chat.
- Google and GitHub OAuth2, JWT access tokens, and an HttpOnly refresh-token cookie.
- Responsive dashboard and navigation with dark and light themes.
- Explore page that presents lessons generated from the signed-in learner's roadmaps.

> **Current product boundaries:** Explore is a GFG-inspired lesson library built from the learner's generated roadmap; it is not a separate public blog/CMS. The coding editor supports editing and saving code, but the backend does not currently provide a sandboxed code-execution/grading API. Coding drafts and activity notes are stored in the browser; roadmap day completion is persisted by the backend.

## Architecture

```text
                           Browser
                    React 19 + Vite SPA
                         localhost:5173
                               |
                   REST / JSON / optional SSE
                               |
                    Spring Cloud API Gateway
                      localhost:8080
                  JWT validation, CORS, routing,
                    Redis-backed rate limiting
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
     User-Service         LearningPath          AI-Service
       :8081              Generator :8085          :8083
   Auth, JWT, OAuth2      Goals, quiz,             Spring AI
   refresh cookie         feasibility,             Groq-compatible
                          roadmap, lessons,        chat and generation
                          mentor orchestration
          |                    |                    |
          v                    v                    |
       MySQL                 MySQL                  |
          \\                    /                    /
           +------------------+---------------------+
                              |
                       Eureka Registry
                         :8761
```

### Backend services

| Service | Default port | Responsibility |
|---|---:|---|
| `ServiceRegistry` | `8761` | Eureka service discovery. |
| `ApiGateway` | `8080` | Browser entry point, JWT validation, CORS, routing, rate limiting, and resilience controls. Management endpoints use port `5051`. |
| `User-Service` | `8081` | Registration, login, JWT access tokens, refresh-token cookies, logout, profile, and Google/GitHub OAuth2. |
| `AIService` | `8083` | Spring AI integration with the configured Groq OpenAI-compatible endpoint; generates AI content and streams model output. |
| `LearningPathGenerator` | `8085` | Learning goals, diagnostic quiz, feasibility, roadmap, lesson generation, completion state, and mentor orchestration. |

The service ports above are the defaults in the current `application.properties` files. Environment variables can override ports where configured.

### Technologies

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 7, React Router 7, Axios, Lucide React, custom CSS |
| Lesson/task UI | React Markdown, remark-gfm, Monaco Editor |
| Backend | Java 17, Spring Boot 3.5.8, Spring Cloud 2025.0.0 |
| Gateway/resilience | Spring Cloud Gateway, Resilience4j, Redis, Micrometer/Prometheus |
| Discovery/communication | Netflix Eureka, OpenFeign, Spring Cloud LoadBalancer |
| AI integration | Spring AI 1.1.0, Groq through an OpenAI-compatible API |
| Authentication | Spring Security, JWT, OAuth2 Client, HttpOnly refresh cookie |
| Persistence | Spring Data JPA, Hibernate, MySQL, Flyway (User-Service) |
| Build/CI | Maven, npm, GitHub Actions, Dockerfiles |

The AI model is configured through `AI_MODEL`; the provider endpoint is configured in `AIService` to use Groq's OpenAI-compatible API.

## Repository structure

```text
AITutor/
├── README.md
├── .env.example
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── PersonalAITutorBackend/
│   ├── README.md
│   ├── ApiGateway/
│   ├── ServiceRegistry/
│   ├── User-Service/
│   ├── AIService/
│   └── LearningPathGenerator/
└── PersonalAITutorFrontend/
    ├── README.md
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── api/
        ├── components/
        ├── context/
        ├── pages/
        ├── App.jsx
        └── styles.css
```

## Frontend routes

The public landing and authentication pages are outside the protected workspace. All learning-workspace pages use the `/app/**` route namespace.

| Route | Access | Page |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Login |
| `/register` | Public | Registration |
| `/auth/success` | OAuth callback | OAuth completion page |
| `/app` | Authenticated | Dashboard |
| `/app/start` | Authenticated | Create a learning goal |
| `/app/quiz` | Authenticated | Diagnostic quiz |
| `/app/feasibility` | Authenticated | Feasibility report |
| `/app/roadmap/:goalId` | Authenticated | Roadmap |
| `/app/lesson/:goalId/:dayNumber` | Authenticated | Lesson and task workspace |
| `/app/explore` | Authenticated | Generated lesson library |
| `/app/profile` | Authenticated | Profile and preferences |

The React route definitions are in `PersonalAITutorFrontend/src/App.jsx`. Nested paths under `/app` are relative route segments; navigation links and `navigate()` calls should use the complete `/app/...` destinations.

## API overview

The frontend uses the API Gateway as its base URL. The default local URL is `http://localhost:8080`.

### Authentication and profile

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a user. |
| `POST` | `/api/auth/login` | Authenticate and return an access token; refresh token is set as an HttpOnly cookie. |
| `POST` | `/api/auth/refresh` | Rotate/refresh the access token using the refresh cookie. |
| `POST` | `/api/auth/logout` | Log out and clear/revoke refresh-token state. |
| `GET` | `/api/user/profile` | Load the authenticated user's profile. |

OAuth authorization starts at `/oauth2/authorization/google` or `/oauth2/authorization/github`. The User-Service redirects to the configured frontend callback at `/auth/success` with the access token and profile query parameters; the frontend callback stores the access token, refreshes the profile, and should send the user to `/app` after successful completion.

### Learning workflow

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/path/testSkills` | Create a goal and generate its diagnostic quiz. |
| `POST` | `/api/path/feasibility` | Submit quiz score/assigned level and get feasibility feedback. |
| `POST` | `/api/path/roadmap?startDay=1&days=7` | Generate a roadmap chunk. |
| `GET` | `/api/path/goals` | List the authenticated user's goals. |
| `GET` | `/api/path/roadmap/{goalId}/days` | Read roadmap days and completion state. |
| `GET` | `/api/path/roadmap/{goalId}/day/{dayNumber}/lesson` | Fetch or generate a lesson. |
| `PATCH` | `/api/path/roadmap/{goalId}/day/{dayNumber}/complete` | Mark a roadmap day complete. |
| `POST` | `/api/path/chat` | Synchronous lesson-aware AI mentor request. |
| `POST` | `/api/path/chat/stream` | Server-Sent Events (SSE) mentor response. |

Legacy learning-path routes are also present: `POST /api/path/generate` and `GET /api/path/all`.

The API Gateway validates bearer tokens on protected routes and supplies the authenticated user identifier to downstream services. The frontend Axios client sends the access token and includes credentials so the browser can send the refresh cookie.

## Local development setup

### Prerequisites

- Java 17+
- Maven 3.8+
- Node.js 20.19+ (or 22.12+) and npm 10+
- MySQL 8+
- Redis (the Gateway's Redis host/port must be reachable)
- A Groq API key for AI generation
- Google and/or GitHub OAuth application credentials if social login is required

Create the database schemas used by the services, or configure each service's `DB_URL` to point at the database/schema you use. The backend documentation refers to `user_auth` for authentication data and `ai_tutor` for learning-path data.

### Configure environment variables

The services read configuration from environment variables and, where configured, an optional service-local `.env` file. Use the keys required by each service's `application.properties`; do not paste real credentials into Git.

**API Gateway**

```dotenv
APP_GATEWAY_SECRET=replace_with_a_long_random_secret
JWT_SECRET=replace_with_the_same_jwt_signing_secret_used_by_User-Service
REDIS_HOST=localhost
REDIS_PORT=6379
EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://localhost:8761/eureka/
```

If you run Redis through the repository's Compose mapping from the host, the published host port is `6380`; set `REDIS_PORT=6380`. If the Gateway itself runs in Docker on the Compose network, use the Redis service hostname and container port (`REDIS_HOST=redis`, `REDIS_PORT=6379`).

**User-Service**

```dotenv
DB_URL=jdbc:mysql://localhost:3306/user_auth
MYSQL_USERNAME=root
MYSQL_PASSWORD=replace_me
BASE_URL=http://localhost:5173
JWT_SECRET=replace_with_the_same_jwt_signing_secret_used_by_ApiGateway
JWT_ISSUER=pathai
INTERNAL_SECRET=replace_with_a_shared_internal_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_SAME_SITE=Lax
```

**LearningPathGenerator**

```dotenv
DB_URL=jdbc:mysql://localhost:3306/ai_tutor
MYSQL_USERNAME=root
MYSQL_PASSWORD=replace_me
APP_INTERNAL_SECRET=replace_with_the_shared_internal_secret
```

**AIService**

```dotenv
OPENAI_API_KEY=your_groq_api_key
AI_MODEL=your_supported_groq_model
EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://localhost:8761/eureka/
INTERNAL_SECRET=replace_with_the_shared_internal_secret
```

`ServiceRegistry` does not require application secrets for its local default configuration.

> **Configuration note:** The checked-in root `.env.example` contains legacy variable names/port values. Treat the per-service `application.properties` files as authoritative and verify the variable names before copying that template. In particular, the current frontend/Gateway default is port `8080`, not the older `5050` value shown in the legacy template.

### Start the backend

Run each service in a separate terminal, from its module directory. Start Eureka first, then the remaining services.

```powershell
# Terminal 1 — Eureka
cd PersonalAITutorBackend/ServiceRegistry
mvn spring-boot:run
```

```powershell
# Terminal 2 — API Gateway
cd PersonalAITutorBackend/ApiGateway
mvn spring-boot:run
```

```powershell
# Terminal 3 — User-Service
cd PersonalAITutorBackend/User-Service
mvn spring-boot:run
```

```powershell
# Terminal 4 — AIService
cd PersonalAITutorBackend/AIService
mvn spring-boot:run
```

```powershell
# Terminal 5 — LearningPathGenerator
cd PersonalAITutorBackend/LearningPathGenerator
mvn spring-boot:run
```

Check the Eureka dashboard at `http://localhost:8761` and confirm the services have registered. The Gateway is available at `http://localhost:8080`.

### Start the frontend

```powershell
cd PersonalAITutorFrontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

The frontend environment template contains:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
VITE_ENABLE_CHAT_STREAMING=false
```

Set `VITE_ENABLE_CHAT_STREAMING=true` to use the SSE mentor endpoint when the corresponding backend route is available through the Gateway. Otherwise, the frontend uses the synchronous `POST /api/path/chat` endpoint. Restart Vite after changing `.env` values.

### Build the frontend

```powershell
cd PersonalAITutorFrontend
npm ci
npm run build
npm run preview
```

The production build is written to `PersonalAITutorFrontend/dist`.

## Docker notes

A frontend Dockerfile is provided in `PersonalAITutorFrontend/Dockerfile`; it builds the Vite app and serves the static output with Nginx on port `80` (the repository's Compose file maps this to host port `3000`).

The root `docker-compose.yml` is a development starting point, not a verified one-command deployment. It currently defines PostgreSQL while the checked-in User-Service and LearningPathGenerator dependencies/configuration use MySQL. Reconcile the database engine, JDBC URLs, environment variables, and Gateway CORS origin before using the Compose stack end to end. When serving the frontend from `http://localhost:3000`, add that origin to the Gateway's allowed CORS origins; the current local Gateway configuration allows `http://localhost:5173`.

For production, use HTTPS, set `REFRESH_COOKIE_SECURE=true`, configure the correct `REFRESH_COOKIE_SAME_SITE` policy, add the deployed frontend origin to Gateway CORS, and store all credentials in your hosting platform's secret manager.

## CI pipeline

GitHub Actions is configured in `.github/workflows/ci.yml`:

- **Backend:** runs `mvn test -B` for `ApiGateway`, `LearningPathGenerator`, `User-Service`, `AIService`, and `ServiceRegistry`.
- **Frontend:** runs `npm ci` followed by `npm run build`.

The frontend CI job currently verifies dependency installation and the production build; it does not run a frontend unit-test suite.

## Further documentation

- [Backend setup and service details](PersonalAITutorBackend/README.md)
- [Frontend setup and API integration details](PersonalAITutorFrontend/README.md)
- [GitHub Actions workflow](.github/workflows/ci.yml)

## Security and contribution notes

- Never commit `.env` files, OAuth client secrets, JWT signing keys, Groq API keys, or internal service secrets.
- Use strong, independently generated secrets for production and keep the JWT signing secret consistent between the Gateway and User-Service.
- Keep refresh tokens in the HttpOnly cookie; do not expose them to frontend JavaScript.
- Use HTTPS in production and restrict CORS to the actual frontend origin.
- Review dependency advisories with `npm audit` and update dependencies deliberately; avoid applying `npm audit fix --force` without reviewing breaking changes.

## License

See the [`LICENSE`](LICENSE) file.
