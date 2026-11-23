import csv
import json
import os
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests

# ============================================================
# CONFIGURATION (ALIGNED WITH TOKEN BUCKET: cap=10, refill=2/1s)
# ============================================================

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")
AI_BASE_URL = os.getenv("AI_BASE_URL", "http://localhost:8083")
AI_GATEWAY_SECRET = os.getenv("AI_GATEWAY_SECRET") or os.getenv("APP_GATEWAY_SECRET") or os.getenv("INTERNAL_SECRET", "")

# Default ~0.55s spacing matches ~2 tokens/sec refill so functional tests don't exhaust the 10-token bucket
REQUEST_DELAY = float(os.getenv("REQUEST_DELAY", "0.55"))
TIMEOUT = int(os.getenv("TIMEOUT", "180"))

# Burst > capacity (10) so we prove both 200 OK (within bucket) and 429 (overflow)
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "25"))

# Multi-sample benchmarking settings
BENCH_SAMPLES = int(os.getenv("BENCH_SAMPLES", "5"))
STREAM_SAMPLES = int(os.getenv("STREAM_SAMPLES", "3"))

# Sustained load settings (intentionally above 2 RPS steady refill to observe 429 throttling under load)
LOAD_WORKERS = int(os.getenv("LOAD_WORKERS", "8"))
LOAD_TOTAL_REQUESTS = int(os.getenv("LOAD_TOTAL_REQUESTS", "40"))

RUN_STARTED_AT = None
HTTP_METRICS = []

session = requests.Session()

access_token = None
user_id = None
goal_id = None
quiz_data = None
test_email = None
test_password = None

results = []
latency_metrics = {}
load_summary = {}


# ============================================================
# REPORTING & STATISTICAL HELPERS
# ============================================================

def record(name, status, expected, passed, details="", latency_ms=None):
    result = {
        "test": name,
        "status": status,
        "expected": expected,
        "result": "PASS" if passed else "FAIL",
        "latency_ms": round(latency_ms, 2) if latency_ms is not None else "",
        "details": str(details)[:1000],
    }
    results.append(result)

    symbol = "PASS" if passed else "FAIL"
    lat_str = f" | Latency: {latency_ms:.1f} ms" if latency_ms is not None else ""
    print(f"[{symbol}] {name} | Status: {status} | Expected: {expected}{lat_str}")
    if details:
        print("       ", str(details)[:400])


def skip(name, reason):
    results.append({
        "test": name,
        "status": "SKIPPED",
        "expected": "N/A",
        "result": "SKIPPED",
        "latency_ms": "",
        "details": reason,
    })
    print(f"[SKIP] {name}: {reason}")


def validate(name, condition, details=""):
    record(name, "ASSERTION", "Valid response data", bool(condition), details)


def percentile(values, p):
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    pos = p * (len(ordered) - 1)
    lo = int(pos)
    hi = min(len(ordered) - 1, lo + 1)
    frac = pos - lo
    return float(ordered[lo] + (ordered[hi] - ordered[lo]) * frac)


def summarize_samples(values):
    clean = [float(v) for v in values if v is not None]
    if not clean:
        return {
            "samples": 0,
            "min_ms": 0.0,
            "p50_ms": 0.0,
            "avg_ms": 0.0,
            "p95_ms": 0.0,
            "p99_ms": 0.0,
            "max_ms": 0.0,
        }
    return {
        "samples": len(clean),
        "min_ms": round(min(clean), 2),
        "p50_ms": round(percentile(clean, 0.50), 2),
        "avg_ms": round(statistics.mean(clean), 2),
        "p95_ms": round(percentile(clean, 0.95), 2),
        "p99_ms": round(percentile(clean, 0.99), 2),
        "max_ms": round(max(clean), 2),
    }


def log_http_metric(method, endpoint, status_code, latency_ms, kind="functional"):
    HTTP_METRICS.append({
        "method": method.upper(),
        "endpoint": endpoint,
        "status_code": status_code,
        "latency_ms": round(latency_ms, 3),
        "kind": kind,
    })


# ============================================================
# HTTP REQUEST HELPERS
# ============================================================

def api_request(
    name,
    method,
    endpoint,
    expected=(200,),
    body=None,
    headers=None,
    base_url=None,
    raw=None,
    timeout=TIMEOUT,
    delay=REQUEST_DELAY,
    metric_key=None,
    kind="functional",
):
    if delay > 0:
        time.sleep(delay)

    url = (base_url or BASE_URL) + endpoint

    try:
        t0 = time.perf_counter()
        response = session.request(
            method=method,
            url=url,
            json=body,
            data=raw,
            headers=headers,
            timeout=timeout,
        )
        latency_ms = (time.perf_counter() - t0) * 1000.0
        log_http_metric(method, endpoint, response.status_code, latency_ms, kind=kind)

        if metric_key:
            latency_metrics[metric_key] = latency_ms

        passed = response.status_code in expected

        try:
            data = response.json()
        except ValueError:
            data = response.text

        record(name, response.status_code, expected, passed, data, latency_ms=latency_ms)
        return response

    except requests.RequestException as error:
        record(name, "CONNECTION_ERROR", expected, False, str(error))
        return None


def repeated_endpoint_benchmark(
    label,
    method,
    endpoint,
    expected=(200,),
    body=None,
    headers=None,
    base_url=None,
    raw=None,
    samples=BENCH_SAMPLES,
    metric_prefix=None,
    kind="repeated_benchmark",
    sample_delay=REQUEST_DELAY,
):
    """Execute an endpoint multiple times with pacing so token bucket refills between samples."""
    runs = max(1, samples)
    url = (base_url or BASE_URL) + endpoint
    sample_latencies = []
    success_count = 0
    last_response = None

    for i in range(runs):
        if sample_delay > 0 and i > 0:
            time.sleep(sample_delay)
        t0 = time.perf_counter()
        try:
            resp = session.request(
                method=method,
                url=url,
                json=body,
                data=raw,
                headers=headers,
                timeout=TIMEOUT,
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            sample_latencies.append(elapsed_ms)
            log_http_metric(method, endpoint, resp.status_code, elapsed_ms, kind=kind)
            last_response = resp
            if resp.status_code in expected:
                success_count += 1
        except requests.RequestException:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            sample_latencies.append(elapsed_ms)
            log_http_metric(method, endpoint, "CONN_ERR", elapsed_ms, kind=kind)

    stats = summarize_samples(sample_latencies)
    if metric_prefix:
        latency_metrics[f"{metric_prefix}_p50_ms"] = stats["p50_ms"]
        latency_metrics[f"{metric_prefix}_avg_ms"] = stats["avg_ms"]
        latency_metrics[f"{metric_prefix}_p95_ms"] = stats["p95_ms"]

    passed = success_count == runs
    details = (
        f"Samples={runs}, Passed={success_count}/{runs}, "
        f"Min={stats['min_ms']}ms, P50={stats['p50_ms']}ms, Avg={stats['avg_ms']}ms, "
        f"P95={stats['p95_ms']}ms, P99={stats['p99_ms']}ms, Max={stats['max_ms']}ms"
    )
    record(
        f"{label} [{runs}x Samples]",
        "BENCHMARKED",
        f"{runs}/{runs} in {expected}",
        passed,
        details,
        latency_ms=stats["p50_ms"],
    )
    return last_response, stats


def response_json(response):
    if response is None:
        return None
    try:
        return response.json()
    except ValueError:
        return None


def auth_headers():
    if not access_token:
        return {}
    return {"Authorization": f"Bearer {access_token}"}


def update_token(response):
    global access_token
    data = response_json(response)
    if isinstance(data, dict):
        new_token = data.get("accessToken")
        if new_token:
            access_token = new_token
            print("\nNew access token received.")


# ============================================================
# 1. HEALTH CHECKS
# ============================================================

def test_health():
    api_request(
        "Gateway / Learning Path Health",
        "GET",
        "/health",
        metric_key="gateway_health_ms",
    )
    repeated_endpoint_benchmark(
        "Gateway /health Latency Profile",
        "GET",
        "/health",
        metric_prefix="gateway_health",
    )

    if AI_GATEWAY_SECRET:
        response = api_request(
            "AI Service Hello",
            "GET",
            "/helloAI",
            base_url=AI_BASE_URL,
            headers={"X-Gateway-Secret": AI_GATEWAY_SECRET},
            metric_key="ai_hello_ms",
        )
        if response and response.status_code == 200:
            validate(
                "AI Hello returned meaningful text",
                len(response.text.strip()) > 10,
                response.text[:300],
            )
    else:
        skip("AI Service Hello", "Set AI_GATEWAY_SECRET to test the direct AI service.")


# ============================================================
# 2. AUTHENTICATION & TOKEN LIFECYCLE
# ============================================================

def test_signup():
    global test_email, test_password

    test_email = f"jatin_{uuid.uuid4().hex[:8]}@pathai.dev"
    test_password = "Jatin@123"

    response = api_request(
        "Signup",
        "POST",
        "/api/auth/signup",
        body={
            "name": "PathAI API Tester",
            "email": test_email,
            "password": test_password,
        },
        metric_key="auth_signup_ms",
    )
    return response is not None and response.status_code == 200


def test_invalid_signup():
    api_request(
        "Signup Validation - Empty Fields",
        "POST",
        "/api/auth/signup",
        expected=(400, 422),
        body={"name": "", "email": "invalid-email", "password": ""},
    )


def test_login():
    global user_id

    response = api_request(
        "Login",
        "POST",
        "/api/auth/login",
        body={"email": test_email, "password": test_password},
        metric_key="auth_login_ms",
    )

    if not response or response.status_code != 200:
        return False

    data = response_json(response)
    update_token(response)

    if isinstance(data, dict):
        user = data.get("user") or {}
        if isinstance(user, dict):
            user_id = user.get("id")

    validate("Login returned access token", bool(access_token))

    if access_token:
        repeated_endpoint_benchmark(
            "Auth JWT Login Latency Profile",
            "POST",
            "/api/auth/login",
            body={"email": test_email, "password": test_password},
            metric_prefix="auth_login",
        )

    return bool(access_token)


def test_invalid_login():
    api_request(
        "Invalid Login",
        "POST",
        "/api/auth/login",
        expected=(400, 401, 403),
        body={"email": test_email, "password": "WrongPassword123!"},
    )


def test_refresh():
    old_token = access_token

    response = api_request(
        "Refresh Token",
        "POST",
        "/api/auth/refresh",
        metric_key="auth_refresh_ms",
    )

    if response and response.status_code == 200:
        update_token(response)
        validate("Refresh returned new access token", bool(access_token))
        validate("Access token rotated", access_token != old_token)


# ============================================================
# 3. SECURITY & AUTHORIZATION BOUNDARIES
# ============================================================

def test_security():
    api_request("Unauthorized User Profile", "GET", "/api/user/profile", expected=(401, 403))
    api_request("Unauthorized Goals", "GET", "/api/path/goals", expected=(401, 403))
    api_request(
        "Invalid JWT",
        "GET",
        "/api/user/profile",
        expected=(401, 403),
        headers={"Authorization": "Bearer invalid.token.value"},
    )
    api_request(
        "User ID Header Spoofing",
        "GET",
        "/api/path/goals",
        expected=(401, 403),
        headers={"X-User-Id": str(uuid.uuid4())},
    )


# ============================================================
# 4. USER SERVICE
# ============================================================

def test_user_service():
    response = api_request(
        "Get User Profile",
        "GET",
        "/api/user/profile",
        headers=auth_headers(),
        metric_key="user_profile_ms",
    )

    data = response_json(response)
    if isinstance(data, dict):
        returned_id = data.get("id")
        if returned_id:
            validate(
                "Profile belongs to authenticated user",
                not user_id or str(returned_id) == str(user_id),
                returned_id,
            )

    repeated_endpoint_benchmark(
        "Get User Profile Latency Profile",
        "GET",
        "/api/user/profile",
        headers=auth_headers(),
        metric_prefix="user_profile",
    )


# ============================================================
# 5. LEARNING PATH - DIAGNOSTIC QUIZ & AI OUTPUT CHECKS
# ============================================================

def test_diagnostic_quiz():
    global quiz_data
    quiz_data = None

    payload = {
        "goal": "Master Java Full Stack Development",
        "currentLevel": "Beginner",
        "timePerDay": 3,
        "duration": 6,
    }

    response = api_request(
        "Generate Diagnostic Quiz",
        "POST",
        "/api/path/testSkills",
        body=payload,
        headers=auth_headers(),
        metric_key="quiz_generation_ms",
    )

    data = response_json(response)
    if not isinstance(data, dict):
        return

    quiz_data = data
    questions = data.get("quiz", [])

    validate(
        "Quiz questions generated",
        isinstance(questions, list) and len(questions) > 0,
        f"Questions: {len(questions) if isinstance(questions, list) else 0}",
    )

    if not questions:
        return

    validate(
        "Quiz question structure (with explanations)",
        all(
            q.get("question")
            and isinstance(q.get("options"), dict)
            and len(q.get("options")) >= 2
            and q.get("correct_answer")
            and bool(q.get("explanation"))
            for q in questions
        ),
        "Verified question, options, correct_answer, and explanation on all items.",
    )

    validate(
        "Quiz did not use degraded fallback",
        not data.get("degraded", False),
        data.get("message", ""),
    )


# ============================================================
# 6. FEASIBILITY ANALYSIS & CACHE IDEMPOTENCY
# ============================================================

def test_feasibility():
    if not quiz_data:
        skip("Feasibility", "Diagnostic quiz was not generated.")
        return

    questions = quiz_data.get("quiz", [])
    if not questions:
        skip("Feasibility", "No quiz questions available.")
        return

    score = sum(1 for q in questions if q.get("correct_answer"))
    percentage = score / len(questions) * 100

    assigned_level = (
        "Advanced"
        if percentage > 80
        else "Intermediate"
        if percentage > 50
        else "Beginner"
    )

    payload = {"score": score, "assignedLevel": assigned_level}

    response = api_request(
        "AI Feasibility Analysis (Cold)",
        "POST",
        "/api/path/feasibility",
        body=payload,
        headers=auth_headers(),
        metric_key="feasibility_generation_ms",
    )

    data = response_json(response)
    if not isinstance(data, dict):
        return

    validate("Feasibility response contains isFeasible", "isFeasible" in data)
    validate("Estimated days is positive", data.get("estimatedDaysRequired", 0) > 0, data.get("estimatedDaysRequired"))
    validate("Expected outcome returned", bool(data.get("expectedOutcome")), data.get("expectedOutcome"))
    validate("Feasibility reason returned", bool(data.get("reason")), data.get("reason"))
    validate("Feasibility did not use degraded fallback", not data.get("degraded", False))

    _, cached_stats = repeated_endpoint_benchmark(
        "Feasibility Refresh / Cached Read",
        "POST",
        "/api/path/feasibility",
        expected=(200,),
        body=payload,
        headers=auth_headers(),
        samples=min(BENCH_SAMPLES, 4),
        metric_prefix="feasibility_cached",
    )
    if cached_stats["p50_ms"] > 0:
        latency_metrics["feasibility_cached_ms"] = cached_stats["p50_ms"]


# ============================================================
# 7. ROADMAP GENERATION (DAYS 1-7)
# ============================================================

def test_roadmap_generation():
    response = api_request(
        "Generate First 7 Days Roadmap",
        "POST",
        "/api/path/roadmap?startDay=1&days=7",
        headers=auth_headers(),
        metric_key="roadmap_generation_ms",
    )

    data = response_json(response)
    if not isinstance(data, dict):
        return

    roadmap = data.get("roadmap", [])

    validate(
        "Roadmap contains 7 days",
        isinstance(roadmap, list) and len(roadmap) == 7,
        f"Generated days: {len(roadmap) if isinstance(roadmap, list) else 0}",
    )

    validate(
        "Roadmap has valid day topics",
        isinstance(roadmap, list)
        and all(d.get("main_topic") or d.get("mainTopic") for d in roadmap),
    )

    validate(
        "Roadmap did not use degraded fallback",
        not data.get("degraded", False),
        data.get("message", ""),
    )


# ============================================================
# 8. FETCH GOALS & SINGLE GOAL RESUME ENDPOINT
# ============================================================

def test_goals():
    global goal_id

    response = api_request(
        "Get All User Goals",
        "GET",
        "/api/path/goals",
        headers=auth_headers(),
        metric_key="get_goals_ms",
    )

    data = response_json(response)

    if isinstance(data, list) and data:
        goal_id = data[0].get("goalId") or data[0].get("id")

        validate("New goal saved in database", bool(goal_id), f"Goal ID: {goal_id}")

        repeated_endpoint_benchmark(
            "Get All User Goals Latency Profile",
            "GET",
            "/api/path/goals",
            headers=auth_headers(),
            metric_prefix="get_goals",
        )

        if goal_id:
            single_res = api_request(
                "Get Single Goal Details (State Resume)",
                "GET",
                f"/api/path/goals/{goal_id}",
                headers=auth_headers(),
                metric_key="get_single_goal_ms",
            )
            single_data = response_json(single_res)
            if isinstance(single_data, dict):
                validate(
                    "Single goal status is ROADMAP_GENERATED",
                    single_data.get("status") == "ROADMAP_GENERATED",
                    single_data.get("status"),
                )
            repeated_endpoint_benchmark(
                "Get Single Goal Details Latency Profile",
                "GET",
                f"/api/path/goals/{goal_id}",
                headers=auth_headers(),
                metric_prefix="get_single_goal",
            )
    else:
        validate("Goal list contains newly created goal", False, data)


# ============================================================
# 9. ROADMAP DAYS
# ============================================================

def test_roadmap_days():
    if not goal_id:
        skip("Get Roadmap Days", "Goal ID unavailable.")
        return

    response = api_request(
        "Get Roadmap Days",
        "GET",
        f"/api/path/roadmap/{goal_id}/days",
        headers=auth_headers(),
        metric_key="get_roadmap_days_ms",
    )

    data = response_json(response)
    if not isinstance(data, dict):
        return

    days = data.get("days", [])
    validate(
        "Roadmap days persisted in database",
        isinstance(days, list) and len(days) == 7,
        f"Stored days: {len(days) if isinstance(days, list) else 0}",
    )

    repeated_endpoint_benchmark(
        "Get Roadmap Days Latency Profile",
        "GET",
        f"/api/path/roadmap/{goal_id}/days",
        headers=auth_headers(),
        metric_prefix="get_roadmap_days",
    )


# ============================================================
# 10. LESSON GENERATION, RESOURCE CHECK & DB CACHE BENCHMARK
# ============================================================

def inspect_lesson_resources(lesson_payload):
    task_obj = lesson_payload.get("task") or {}
    task_content = task_obj.get("content") if isinstance(task_obj, dict) else {}
    task_data = lesson_payload.get("taskData") or (task_content if isinstance(task_content, dict) else {})

    resources = lesson_payload.get("resources")
    if not isinstance(resources, list) or not resources:
        resources = task_data.get("resources") if isinstance(task_data, dict) else []

    if not isinstance(resources, list) or not resources:
        validate(
            "Lesson Resources Present (3 Videos + 2 Docs)",
            False,
            "No resources array found in lesson or taskData; check if LessonResourceService is wired in AIService.",
        )
        return

    direct_videos, search_videos, direct_docs, search_docs = [], [], [], []
    for item in resources:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "")
        title = str(item.get("title") or "")
        rtype = str(item.get("type") or "").upper()
        is_video = rtype == "VIDEO" or "youtube.com/watch" in url or "youtu.be/" in url or "youtube.com/results" in url
        if is_video:
            if "youtube.com/watch" in url or "youtu.be/" in url:
                direct_videos.append(f"{title} -> {url}")
            else:
                search_videos.append(f"{title} -> {url}")
        else:
            if "google.com/search" in url or "/results?search_query" in url or not url.startswith("https://"):
                search_docs.append(f"{title} -> {url}")
            else:
                direct_docs.append(f"{title} -> {url}")

    summary = (
        f"Total={len(resources)} | "
        f"DirectYouTubeVideos={len(direct_videos)}, SearchFallbackVideos={len(search_videos)} | "
        f"DirectDocs={len(direct_docs)}, SearchFallbackDocs={len(search_docs)} | "
        f"Items={[(r.get('type'), r.get('title'), r.get('url')) for r in resources]}"
    )

    validate("Lesson Returned 5 Curated Links (3 Videos + 2 Docs)", len(resources) == 5, summary)
    if len(direct_videos) == 0:
        print("       [DIAGNOSTIC] YouTube Data API returned 0 direct watch links (using search fallback). Check YOUTUBE_API_KEY and LearningPathGenerator logs.")


def test_lesson():
    if not goal_id:
        skip("Get Lesson", "Goal ID unavailable.")
        return

    response = api_request(
        "Generate Lesson Day 1 (Cold AI Call)",
        "GET",
        f"/api/path/roadmap/{goal_id}/day/1/lesson",
        headers=auth_headers(),
        metric_key="lesson_ai_generation_ms",
    )

    data = response_json(response)
    if not isinstance(data, dict):
        return

    content = data.get("lesson") or data.get("content") or ""
    validate(
        "Lesson content generated",
        isinstance(content, str) and len(content.strip()) > 200,
        f"Content length: {len(content) if isinstance(content, str) else 0} chars",
    )
    validate(
        "Lesson task type returned",
        bool(data.get("taskType") or (isinstance(data.get("task"), dict) and data["task"].get("type"))),
        data.get("taskType") or (data.get("task") or {}).get("type"),
    )
    validate("Lesson did not use degraded fallback", not data.get("degraded", False))
    inspect_lesson_resources(data)

    _, warm_stats = repeated_endpoint_benchmark(
        "Fetch Lesson Day 1 (DB Cache Warm Reads)",
        "GET",
        f"/api/path/roadmap/{goal_id}/day/1/lesson",
        headers=auth_headers(),
        samples=BENCH_SAMPLES,
        metric_prefix="lesson_db_cache",
    )
    if warm_stats["p50_ms"] > 0:
        latency_metrics["lesson_db_cache_ms"] = warm_stats["p50_ms"]


# ============================================================
# 11. COMPLETE ROADMAP DAYS & 80% GATE UNLOCK TEST
# ============================================================

def test_complete_day_and_80_percent_gate():
    if not goal_id:
        skip("Complete Roadmap Day & 80% Gate", "Goal ID unavailable.")
        return

    api_request(
        "80% Gate Block Check (Premature Days 8-14)",
        "POST",
        f"/api/path/roadmap?goalId={goal_id}&startDay=8&days=7",
        expected=(400,),
        headers=auth_headers(),
    )

    for day_num in range(1, 7):
        res = api_request(
            f"Mark Day {day_num} Complete",
            "PATCH",
            f"/api/path/roadmap/{goal_id}/day/{day_num}/complete",
            headers=auth_headers(),
        )
        if not res or res.status_code != 200:
            return

    response = api_request(
        "Verify Day 1-6 Completion Persisted",
        "GET",
        f"/api/path/roadmap/{goal_id}/days",
        headers=auth_headers(),
    )

    data = response_json(response)
    if isinstance(data, dict):
        days = data.get("days", [])
        completed_count = sum(1 for d in days if d.get("completed") is True)
        validate(
            "6 of 7 days marked completed in DB",
            completed_count == 6,
            f"Completed: {completed_count}/7",
        )

    res_next = api_request(
        "Generate Days 8-14 (Unlocked at 85.7%)",
        "POST",
        f"/api/path/roadmap?goalId={goal_id}&startDay=8&days=7",
        headers=auth_headers(),
        metric_key="roadmap_next_chunk_ms",
    )
    next_data = response_json(res_next)
    if isinstance(next_data, dict):
        validate(
            "Days 8-14 generated cleanly",
            len(next_data.get("roadmap", [])) == 7,
            f"Generated days: {len(next_data.get('roadmap', []))}",
        )


# ============================================================
# 12. AI MENTOR CHAT (BLOCKING + MULTI-SAMPLE SSE STREAM TTFT)
# ============================================================

def test_ai_chat():
    response = api_request(
        "AI Mentor Chat (Blocking)",
        "POST",
        "/api/path/chat",
        headers=auth_headers(),
        body={
            "message": "Explain Java inheritance with a practical example.",
            "lessonTitle": "Java OOP",
            "lessonContent": "Inheritance allows a class to reuse another class.",
        },
        metric_key="mentor_chat_blocking_ms",
    )

    data = response_json(response)
    if isinstance(data, dict):
        answer = str(data.get("response", ""))
        validate("AI chat returned a meaningful answer", len(answer.strip()) > 30, answer)
        validate("AI chat did not return fallback message", "unavailable" not in answer.lower())

    url = BASE_URL + "/api/path/chat/stream"
    stream_headers = {
        **auth_headers(),
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }
    payload = {
        "message": "Write a 3-line Java for loop.",
        "lessonTitle": "Java Loops",
        "lessonContent": "Loops repeat execution.",
    }

    ttft_samples = []
    stream_runs = max(1, STREAM_SAMPLES)
    last_status = None
    last_chunks = 0

    for i in range(stream_runs):
        if REQUEST_DELAY > 0 and i > 0:
            time.sleep(REQUEST_DELAY)
        try:
            t0 = time.perf_counter()
            ttft_ms = None
            token_chunks = 0
            with session.post(url, json=payload, headers=stream_headers, stream=True, timeout=60) as sr:
                status_code = sr.status_code
                last_status = status_code
                for line in sr.iter_lines(decode_unicode=True):
                    if line and line.startswith("data:"):
                        if ttft_ms is None:
                            ttft_ms = (time.perf_counter() - t0) * 1000.0
                        token_chunks += 1
                        if token_chunks >= 5:
                            break
            total_stream_ms = (time.perf_counter() - t0) * 1000.0
            last_chunks = token_chunks
            log_http_metric("POST", "/api/path/chat/stream", status_code, ttft_ms or total_stream_ms, kind="stream_ttft")
            if status_code == 200 and ttft_ms is not None:
                ttft_samples.append(ttft_ms)
        except requests.RequestException as err:
            record("AI Mentor Chat (SSE Stream TTFT)", "CONNECTION_ERROR", (200,), False, str(err))
            return

    if ttft_samples:
        ttft_stats = summarize_samples(ttft_samples)
        latency_metrics["sse_stream_ttft_ms"] = ttft_stats["p50_ms"]
        latency_metrics["sse_stream_ttft_avg_ms"] = ttft_stats["avg_ms"]
        latency_metrics["sse_stream_ttft_p95_ms"] = ttft_stats["p95_ms"]
        record(
            f"AI Mentor Chat (SSE Stream TTFT) [{stream_runs}x Samples]",
            last_status,
            (200,),
            len(ttft_samples) == stream_runs,
            f"P50 TTFT={ttft_stats['p50_ms']}ms ({ttft_stats['p50_ms']/1000:.2f}s), "
            f"Avg TTFT={ttft_stats['avg_ms']}ms, P95 TTFT={ttft_stats['p95_ms']}ms, SampledChunks={last_chunks}",
            latency_ms=ttft_stats["p50_ms"],
        )
    else:
        record("AI Mentor Chat (SSE Stream TTFT)", last_status or "NO_DATA", (200,), False, "No SSE chunks received")


# ============================================================
# 13. LEGACY LEARNING PATH GENERATOR
# ============================================================

def test_legacy_path_generation():
    response = api_request(
        "Generate Career Learning Path",
        "POST",
        "/api/path/generate",
        headers=auth_headers(),
        body={
            "currentSkills": "Java, Spring Boot, React, MySQL",
            "careerGoal": "Backend Software Engineer",
            "learningStyle": "Project Based",
            "difficultyLevel": "Intermediate",
            "preferredDuration": "3 Months",
        },
        metric_key="legacy_path_gen_ms",
    )

    if not response or response.status_code != 200:
        return

    try:
        data = response.json()
        if isinstance(data, str):
            data = json.loads(data)
    except (ValueError, TypeError):
        data = None

    validate(
        "Legacy AI path returned valid JSON",
        isinstance(data, dict) and bool(data.get("title")) and isinstance(data.get("weeks"), list),
        data,
    )


# ============================================================
# 14. GET ALL LEGACY PATHS
# ============================================================

def test_all_paths():
    response = api_request(
        "Get All Learning Paths",
        "GET",
        "/api/path/all",
        headers=auth_headers(),
        metric_key="get_all_paths_ms",
    )

    data = response_json(response)
    if not isinstance(data, list):
        return

    validate("Learning paths endpoint returned a list", isinstance(data, list))

    if user_id and data:
        foreign_paths = [p for p in data if str(p.get("userId")) != str(user_id)]
        validate(
            "SECURITY: No other users' paths exposed",
            len(foreign_paths) == 0,
            f"Foreign records found: {len(foreign_paths)}",
        )

    repeated_endpoint_benchmark(
        "Get All Learning Paths Latency Profile",
        "GET",
        "/api/path/all",
        headers=auth_headers(),
        metric_prefix="get_all_paths",
    )


# ============================================================
# 15. DIRECT AI SERVICE TESTS
# ============================================================

def test_direct_ai_service():
    if not AI_GATEWAY_SECRET:
        skip("Direct AI API Tests", "Set AI_GATEWAY_SECRET.")
        return

    headers = {"X-Gateway-Secret": AI_GATEWAY_SECRET, "Content-Type": "application/json"}
    prompt = "Explain REST API in simple terms. Give one Java Spring Boot example."

    response = api_request(
        "Direct AI Generate API",
        "POST",
        "/api/ai/generate",
        base_url=AI_BASE_URL,
        headers=headers,
        raw=json.dumps(prompt),
        metric_key="direct_ai_generate_ms",
    )

    if response and response.status_code == 200:
        validate("Direct AI generated meaningful response", len(response.text.strip()) > 30, response.text[:500])


# ============================================================
# 16. REDIS LUA TOKEN-BUCKET RATE LIMITER BURST ENFORCEMENT TEST
# ============================================================

def test_rate_limiter():
    # Let the bucket refill cleanly before running an explicit burst overflow check
    time.sleep(5.0)

    burst_size = max(12, RATE_LIMIT_BURST)
    ok_200 = 0
    limited_429 = 0
    other_status = {}
    latencies = []
    req_headers = auth_headers()

    def burst_request(_):
        worker_session = requests.Session()
        t0 = time.perf_counter()
        try:
            r = worker_session.get(BASE_URL + "/api/path/goals", headers=req_headers, timeout=15)
            latency = (time.perf_counter() - t0) * 1000.0
            return r.status_code, latency
        except requests.RequestException:
            latency = (time.perf_counter() - t0) * 1000.0
            return "ERROR", latency

    with ThreadPoolExecutor(max_workers=min(burst_size, 50)) as pool:
        futures = [pool.submit(burst_request, i) for i in range(burst_size)]
        for future in as_completed(futures):
            status, latency = future.result()
            latencies.append(latency)
            log_http_metric("GET", "/api/path/goals", status, latency, kind="concurrent_rate_limit_burst")
            if status == 200:
                ok_200 += 1
            elif status == 429:
                limited_429 += 1
            else:
                key = str(status)
                other_status[key] = other_status.get(key, 0) + 1

    stats = summarize_samples(latencies)
    latency_metrics["gateway_burst_avg_ms"] = stats["avg_ms"]
    latency_metrics["gateway_burst_p95_ms"] = stats["p95_ms"]

    # With capacity=10 and burst >= 12, rate limiter should allow up to bucket capacity and reject overflow with 429
    enforced = len(latencies) == burst_size and ok_200 > 0 and limited_429 > 0 and not other_status

    record(
        f"Concurrent Redis Rate-Limiter Burst ({burst_size} requests)",
        "COMPLETED",
        "Both 200 OK and 429 throttled observed (no 5xx/errors)",
        enforced,
        f"Workers={min(burst_size, 50)}, Total={len(latencies)}, 200 OK={ok_200}, "
        f"429 RateLimited={limited_429}, Other={other_status}, "
        f"Avg={stats['avg_ms']}ms, P95={stats['p95_ms']}ms",
        latency_ms=stats["avg_ms"],
    )


# ============================================================
# 17. SUSTAINED MULTI-ENDPOINT LOAD & THROUGHPUT BENCHMARK
# ============================================================

def test_sustained_load():
    global load_summary

    if not access_token:
        skip("Sustained Load Benchmark", "No access token available.")
        return

    total_reqs = max(10, LOAD_TOTAL_REQUESTS)
    workers = max(1, min(LOAD_WORKERS, total_reqs, 40))
    req_headers = auth_headers()

    endpoints = [
        ("GET", "/api/user/profile", None),
        ("GET", "/api/path/goals", None),
        ("GET", "/api/path/all", None),
    ]
    if goal_id:
        endpoints.append(("GET", f"/api/path/roadmap/{goal_id}/days", None))
        endpoints.append(("GET", f"/api/path/roadmap/{goal_id}/day/1/lesson", None))

    status_counts = {}
    latencies = []
    errors = 0

    def worker_call(idx):
        method, path, body = endpoints[idx % len(endpoints)]
        ws = requests.Session()
        t0 = time.perf_counter()
        try:
            resp = ws.request(method=method, url=BASE_URL + path, headers=req_headers, json=body, timeout=30)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return resp.status_code, elapsed_ms, path
        except requests.RequestException:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return "CONN_ERR", elapsed_ms, path

    start_wall = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(worker_call, i) for i in range(total_reqs)]
        for fut in as_completed(futures):
            code, ms, path = fut.result()
            latencies.append(ms)
            key = str(code)
            status_counts[key] = status_counts.get(key, 0) + 1
            if code == "CONN_ERR" or (isinstance(code, int) and code >= 500):
                errors += 1
            log_http_metric("GET", path, code, ms, kind="sustained_load")

    wall_sec = max(0.001, time.perf_counter() - start_wall)
    rps = len(latencies) / wall_sec
    stats = summarize_samples(latencies)

    latency_metrics["sustained_load_rps"] = rps
    latency_metrics["sustained_load_avg_ms"] = stats["avg_ms"]
    latency_metrics["sustained_load_p50_ms"] = stats["p50_ms"]
    latency_metrics["sustained_load_p95_ms"] = stats["p95_ms"]
    latency_metrics["sustained_load_p99_ms"] = stats["p99_ms"]

    load_summary = {
        "workers": workers,
        "total_requests": len(latencies),
        "duration_sec": round(wall_sec, 2),
        "throughput_rps": round(rps, 2),
        "avg_ms": stats["avg_ms"],
        "p50_ms": stats["p50_ms"],
        "p95_ms": stats["p95_ms"],
        "p99_ms": stats["p99_ms"],
        "status_counts": status_counts,
        "server_or_conn_errors": errors,
    }

    details = (
        f"Workers={workers}, Requests={len(latencies)}, Duration={wall_sec:.2f}s, "
        f"Throughput={rps:.2f} RPS, Statuses={status_counts}, "
        f"Avg={stats['avg_ms']}ms, P50={stats['p50_ms']}ms, P95={stats['p95_ms']}ms, P99={stats['p99_ms']}ms"
    )

    record(
        f"Sustained Concurrent Load ({total_reqs} reqs @ {workers} workers)",
        "COMPLETED",
        "Zero 5xx/connection errors",
        errors == 0 and len(latencies) == total_reqs,
        details,
        latency_ms=stats["avg_ms"],
    )


# ============================================================
# 18. LOGOUT AND REFRESH TOKEN REVOCATION
# ============================================================

def test_logout():
    refresh_cookie = session.cookies.get("refresh")

    response = api_request("Logout", "POST", "/api/auth/logout", metric_key="auth_logout_ms")
    if not response or response.status_code != 200:
        return

    if not refresh_cookie:
        skip("Refresh Token Revocation", "No refresh cookie was available.")
        return

    replay_session = requests.Session()
    time.sleep(REQUEST_DELAY)

    replay = replay_session.post(
        BASE_URL + "/api/auth/refresh",
        headers={"Cookie": f"refresh={refresh_cookie}"},
        timeout=TIMEOUT,
    )

    record(
        "Logout Revokes Refresh Token",
        replay.status_code,
        401,
        replay.status_code == 401,
        replay.text[:300],
    )

    if replay.status_code == 200:
        new_cookie = replay_session.cookies.get("refresh")
        if new_cookie:
            replay_session.post(
                BASE_URL + "/api/auth/logout",
                headers={"Cookie": f"refresh={new_cookie}"},
                timeout=TIMEOUT,
            )


# ============================================================
# 19. EXPORT CSV, JSON & RESUME-READY BENCHMARK METRICS
# ============================================================

def build_http_summary():
    latencies = [m["latency_ms"] for m in HTTP_METRICS if m.get("latency_ms") is not None]
    grouped = {}
    for m in HTTP_METRICS:
        key = f'{m["method"]} {m["endpoint"]}'
        grouped.setdefault(key, []).append(m)

    per_endpoint = {}
    for key, items in grouped.items():
        ls = [i["latency_ms"] for i in items]
        codes = {}
        for i in items:
            c = str(i["status_code"])
            codes[c] = codes.get(c, 0) + 1
        ep_stats = summarize_samples(ls)
        per_endpoint[key] = {
            "requests": len(items),
            "status_codes": codes,
            **ep_stats,
        }

    overall = summarize_samples(latencies)
    duration = (time.perf_counter() - RUN_STARTED_AT) if RUN_STARTED_AT else 0.0

    ai_gen = latency_metrics.get("lesson_ai_generation_ms", 0.0)
    db_cache_p50 = latency_metrics.get("lesson_db_cache_p50_ms", latency_metrics.get("lesson_db_cache_ms", 0.0))
    lesson_speedup = round(ai_gen / db_cache_p50, 1) if db_cache_p50 > 0 else 0.0

    feas_cold = latency_metrics.get("feasibility_generation_ms", 0.0)
    feas_warm_p50 = latency_metrics.get("feasibility_cached_p50_ms", latency_metrics.get("feasibility_cached_ms", 0.0))
    feas_speedup = round(feas_cold / feas_warm_p50, 1) if feas_warm_p50 > 0 else 0.0

    ttft_p50_ms = latency_metrics.get("sse_stream_ttft_ms", 0.0)

    resume_metrics = {
        "lesson_cold_vs_warm_median_speedup_x": lesson_speedup,
        "lesson_cold_ms": round(ai_gen, 2),
        "lesson_warm_p50_ms": round(db_cache_p50, 2),
        "feasibility_cold_vs_warm_median_speedup_x": feas_speedup,
        "sse_stream_ttft_p50_sec": round(ttft_p50_ms / 1000.0, 2),
        "sse_stream_ttft_p50_ms": round(ttft_p50_ms, 2),
        "sustained_load_rps": round(latency_metrics.get("sustained_load_rps", 0.0), 2),
        "sustained_load_p50_ms": round(latency_metrics.get("sustained_load_p50_ms", 0.0), 2),
        "sustained_load_p95_ms": round(latency_metrics.get("sustained_load_p95_ms", 0.0), 2),
        "sustained_load_p99_ms": round(latency_metrics.get("sustained_load_p99_ms", 0.0), 2),
        "gateway_burst_avg_ms": round(latency_metrics.get("gateway_burst_avg_ms", 0.0), 2),
        "gateway_burst_p95_ms": round(latency_metrics.get("gateway_burst_p95_ms", 0.0), 2),
    }

    return {
        "request_count": len(HTTP_METRICS),
        "run_duration_seconds": round(duration, 2),
        "requests_per_second_including_test_workflow": round(len(HTTP_METRICS) / duration, 2) if duration else 0.0,
        "latency_avg_ms": overall["avg_ms"],
        "latency_p50_ms": overall["p50_ms"],
        "latency_p95_ms": overall["p95_ms"],
        "latency_p99_ms": overall["p99_ms"],
        "latency_min_ms": overall["min_ms"],
        "latency_max_ms": overall["max_ms"],
        "resume_metrics": resume_metrics,
        "sustained_load_benchmark": load_summary,
        "per_endpoint": per_endpoint,
        "raw_http_measurements": HTTP_METRICS,
    }


def export_reports():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_file = f"aitutor_report_{timestamp}.csv"
    json_file = f"aitutor_report_{timestamp}.json"

    with open(csv_file, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["test", "status", "expected", "result", "latency_ms", "details"],
        )
        writer.writeheader()
        writer.writerows(results)

    perf = build_http_summary()
    resume = perf["resume_metrics"]

    with open(json_file, "w", encoding="utf-8") as file:
        json.dump(
            {
                "summary": {
                    "total": len(results),
                    "passed": sum(1 for r in results if r["result"] == "PASS"),
                    "failed": sum(1 for r in results if r["result"] == "FAIL"),
                    "skipped": sum(1 for r in results if r["result"] == "SKIPPED"),
                },
                "measured_metrics_ms_and_rps": {k: round(v, 2) for k, v in latency_metrics.items()},
                "http_performance": perf,
                "results": results,
            },
            file,
            indent=4,
            ensure_ascii=False,
        )

    total = len(results)
    passed = sum(1 for r in results if r["result"] == "PASS")
    failed = sum(1 for r in results if r["result"] == "FAIL")
    skipped = sum(1 for r in results if r["result"] == "SKIPPED")

    print("\n" + "=" * 75)
    print("                 PATHAI INTEGRATION TEST REPORT")
    print("=" * 75)
    print("Total Tests :", total)
    print("Passed      :", passed)
    print("Failed      :", failed)
    print("Skipped     :", skipped)
    if passed + failed:
        print("Pass Rate   :", f"{passed / (passed + failed) * 100:.2f}%")

    print("\n--- RESUME-READY BENCHMARK SUMMARY (MEDIAN / P50 & P95) ---")
    print(f"  Lesson DB Cache Speedup (P50)   : {resume['lesson_cold_vs_warm_median_speedup_x']}x ({resume['lesson_cold_ms']} ms cold -> {resume['lesson_warm_p50_ms']} ms warm P50)")
    print(f"  Feasibility Cache Speedup (P50) : {resume['feasibility_cold_vs_warm_median_speedup_x']}x")
    print(f"  SSE Mentor Stream TTFT (P50)    : {resume['sse_stream_ttft_p50_sec']} s ({resume['sse_stream_ttft_p50_ms']} ms)")
    print(f"  Sustained Load Throughput       : {resume['sustained_load_rps']} RPS (P50 {resume['sustained_load_p50_ms']} ms | P95 {resume['sustained_load_p95_ms']} ms | P99 {resume['sustained_load_p99_ms']} ms)")
    print(f"  Rate-Limiter Burst ({RATE_LIMIT_BURST} reqs)  : Avg {resume['gateway_burst_avg_ms']} ms | P95 {resume['gateway_burst_p95_ms']} ms")

    print("\n--- PER-ENDPOINT LATENCY PROFILE ---")
    for ep, stats in perf["per_endpoint"].items():
        print(
            f"  {ep:<42} | n={stats['requests']:<3} | "
            f"P50={stats['p50_ms']:>7.2f}ms | Avg={stats['avg_ms']:>7.2f}ms | P95={stats['p95_ms']:>7.2f}ms"
        )

    print("\nCSV Report :", csv_file)
    print("JSON Report:", json_file)
    print("=" * 75)


# ============================================================
# MAIN TEST EXECUTION
# ============================================================

def main():
    global RUN_STARTED_AT
    RUN_STARTED_AT = time.perf_counter()
    print("\n" + "=" * 75)
    print("              PATHAI COMPLETE APPLICATION TEST")
    print("=" * 75)
    print("Gateway URL  :", BASE_URL)
    print("AI URL       :", AI_BASE_URL)
    print("Request Delay:", REQUEST_DELAY, "s | Burst Size:", RATE_LIMIT_BURST)
    print("Bench Samples:", BENCH_SAMPLES, "| Stream Samples:", STREAM_SAMPLES)
    print("\nStarting tests...\n")

    test_health()
    test_invalid_signup()

    if not test_signup():
        print("\nSignup failed. Cannot continue authenticated workflow.")
        export_reports()
        return

    test_invalid_login()

    if not test_login():
        print("\nLogin failed. Cannot continue authenticated workflow.")
        export_reports()
        return

    test_refresh()
    test_security()
    test_user_service()

    test_diagnostic_quiz()
    test_feasibility()
    test_roadmap_generation()
    test_goals()
    test_roadmap_days()
    test_lesson()
    test_complete_day_and_80_percent_gate()
    test_ai_chat()

    test_legacy_path_generation()
    test_all_paths()
    test_direct_ai_service()
    test_rate_limiter()
    test_sustained_load()

    # Logout must be last
    test_logout()

    export_reports()


if __name__ == "__main__":
    main()