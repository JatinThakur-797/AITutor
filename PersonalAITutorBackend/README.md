# 🔧 AITutor Backend — Spring Boot Microservices

> The backend for **PathAI / AITutor** is a distributed **Spring Boot microservice mesh** handling authentication, AI content generation, learning path management, and intelligent routing — all coordinated through a centralized API Gateway.

---

## 🏗️ Architecture Overview

```
                        ┌──────────────────────┐
                        │    React Frontend     │
                        │    (Port 5173)        │
                        └──────────┬───────────┘
                                   │ HTTP
                        ┌──────────▼───────────┐
                        │    API Gateway        │  ← Port 5050
                        │  (Spring Cloud)       │  ← Redis Session Cache
                        │  (JWT Filter)         │  ← CORS Coordinator
                        └──┬────────┬─────┬────┘
                           │        │     │
             ┌─────────────┘  ┌─────┘   ┌─┘
    ┌─────────▼──────┐ ┌──────▼──────┐ ┌▼───────────────────┐
    │  User-Service  │ │  AI-Service │ │ LearningPath-       │
    │  (Port 8080)   │ │  (Port 1010)│ │ Generator (8085)    │
    │  JWT Auth      │ │  Groq LLM   │ │ Goal/Quiz/Roadmap   │
    │  OAuth2        │ │  Spring AI  │ │ Lesson Generation   │
    │  MySQL         │ │             │ │ MySQL               │
    └────────────────┘ └─────────────┘ └─────────────────────┘
              ↑               ↑                  ↑
              └───────────────┴──────────────────┘
                          Eureka Registry
                           (Port 8761)
```

---

## 📦 Services

### 1. `ServiceRegistry` — Eureka Discovery (Port 8761)
- Netflix Eureka Server — all microservices register here
- Provides dynamic load balancing and service location

### 2. `ApiGateway` — Spring Cloud Gateway (Port 5050)
- **Single entry point** for all client traffic
- Custom `AuthenticationFilter` — validates JWT on every protected route
- CORS configuration for the React frontend
- Redis caching layer for session data
- Routes:
  - `/api/user/**` → User-Service
  - `/api/auth/**`, `/oauth2/**`, `/login/**` → User-Service
  - `/api/path/**` → LearningPathGenerator

### 3. `User-Service` — Authentication Service (Port 8080)
- **JWT Authentication**: Issues access tokens (100 min) + refresh tokens (30 days via HttpOnly cookie)
- **Token Rotation**: Stateless refresh without server-side session state
- **OAuth2 Social Login**: Google & GitHub OAuth2 integration via Spring Security
- **Database**: MySQL `user_auth` schema with Flyway migrations
- **Endpoints**: Register, Login, Refresh Token, Logout, Get Profile

### 4. `AIService` — LLM Prompt Executor (Port 1010)
- Powered by **Spring AI** using OpenAI-compatible API
- Connected to **Groq Cloud** running `llama-3.3-70b-versatile`
- Ultra-fast LLM inference via Groq's GroqChip hardware
- Handles: quiz generation, feasibility analysis, roadmap building, lesson content, AI chat mentor

### 5. `LearningPathGenerator` — Core Learning Engine (Port 8085)
- Orchestrates the full 5-phase AI tutoring pipeline
- Communicates with `AIService` via **OpenFeign** client
- **Database**: MySQL `ai_tutor` schema
- Features:
  - **Diagnostic Quiz**: 10-question skill assessment, assigns difficulty baseline
  - **Feasibility Check**: Validates user's self-reported timeline vs. actual quiz score
  - **Roadmap Builder**: Generates structured day-by-day study plan
  - **JIT Lesson Engine**: Generates and caches lesson content only when accessed
  - **AI Chat Mentor**: Floating inline assistant scoped to current lesson context

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Spring Boot 3.5.8 |
| Language | Java 17 |
| Service Mesh | Spring Cloud 2025.0.0 |
| Gateway | Spring Cloud Gateway |
| Service Discovery | Netflix Eureka |
| AI Integration | Spring AI 1.1.0 |
| LLM Provider | Groq Cloud (llama-3.3-70b-versatile) |
| Auth | Spring Security + JWT (jjwt 0.11.5) |
| OAuth2 | Spring Security OAuth2 Client |
| HTTP Client | OpenFeign |
| ORM | Spring Data JPA + Hibernate |
| Database | MySQL 8 |
| Migrations | Flyway |
| Caching | Redis |
| Build | Maven |
| Utils | Lombok |

---

## ⚙️ Setup & Configuration

### Prerequisites
- Java 17+
- Maven 3.8+
- MySQL 8.x running locally
- Redis running locally (port 6379)
- Groq API Key ([groq.com](https://console.groq.com/))
- Google OAuth2 App credentials
- GitHub OAuth2 App credentials

### Database Setup
```sql
-- For User-Service
CREATE DATABASE user_auth;

-- For LearningPathGenerator
CREATE DATABASE ai_tutor;
```

### Environment Variables

Each service reads credentials from OS environment variables. Copy `.env.example` to `.env` in each service directory and fill in values.

#### AI-Service (`AIService/.env.example`):
```env
OPENAI_API_KEY=your_groq_api_key_here
```

#### User-Service (`User-Service/.env.example`):
```env
MYSQL_PASSWORD=your_mysql_password
APP_JWT_SECRET=your_min_32_char_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

#### LearningPathGenerator (`LearningPathGenerator/.env.example`):
```env
MYSQL_PASSWORD=your_mysql_password
```

### Starting Services (Order Matters!)

```bash
# 1. Start Eureka Service Registry first
cd ServiceRegistry && mvn spring-boot:run

# 2. Start User-Service
cd User-Service && mvn spring-boot:run -DMYSQL_PASSWORD=xxx -DAPP_JWT_SECRET=xxx ...

# 3. Start AI Service
cd AIService && mvn spring-boot:run -DOPENAI_API_KEY=gsk_xxx

# 4. Start Learning Path Generator
cd LearningPathGenerator && mvn spring-boot:run -DMYSQL_PASSWORD=xxx

# 5. Start API Gateway last
cd ApiGateway && mvn spring-boot:run
```

---

## 🧩 Challenges Solved

### 1. Cross-Service JWT Validation Without Shared State
The ApiGateway validates JWTs using the same secret as User-Service without direct DB calls — a stateless, fast validation using only HMAC-SHA signature verification.

### 2. Long LLM Response Timeouts with Feign
Groq LLM responses for full lesson generation can take 30-60 seconds. Solved by configuring Feign client `readTimeout=600000ms` and extending Spring's default `60s` response deadline.

### 3. OAuth2 Token → JWT Bridge
After social login (Google/GitHub), Spring Security's OAuth2 success handler extracts user details, persists to MySQL, and issues our own JWT pair — bridging the OAuth2 session into our stateless JWT system.

### 4. CORS + HttpOnly Cookie + Gateway Coordination
The React SPA needs both `Authorization: Bearer <token>` header AND the HttpOnly `refreshToken` cookie to pass through. Required careful coordination in the gateway's CORS config (`allow-credentials=true`, `exposed-headers=Authorization,Set-Cookie`).

---

## 📁 Project Structure

```
PersonalAITutorBackend/
├── ServiceRegistry/          # Eureka server
│   └── src/main/
│       ├── java/             # EurekaServerApplication.java
│       └── resources/application.properties
├── ApiGateway/               # Spring Cloud Gateway + Auth filter
│   └── src/main/
│       ├── java/             # Gateway config, AuthenticationFilter
│       └── resources/application.properties
├── User-Service/             # Auth, JWT, OAuth2
│   └── src/main/
│       ├── java/             # Controllers, Services, JwtUtil, Security config
│       └── resources/
│           ├── application.properties
│           └── db/migration/ # Flyway SQL migrations
├── AIService/                # Spring AI / Groq integration
│   └── src/main/
│       ├── java/             # AIController, AIService (prompt logic)
│       └── resources/application.properties
└── LearningPathGenerator/    # Orchestration engine
    └── src/main/
        ├── java/             # Controllers, Services, Feign clients, JPA entities
        └── resources/application.properties
```