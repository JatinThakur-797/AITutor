import api from "./axiosClient";

export const generateTestQuiz = (data) =>
    api.post("/api/path/testSkills", data);

export const checkFeasibility = (reportData) =>
    api.post("/api/path/feasibility", reportData);

// ✅ FIX: Backend no longer needs reportData body in /roadmap
// Feasibility is now read from DB on the server side
export const generateRoadmap = (startDay, days) =>
    api.post(`/api/path/roadmap?startDay=${startDay}&days=${days}`);

export const getAllGoals = () =>
    api.get("/api/path/goals");

export const markDayComplete = (goalId, dayNumber) =>
    api.patch(`/api/path/roadmap/${goalId}/day/${dayNumber}/complete`);
// Fetch existing roadmap days for a goal
export const getRoadmapDays = (goalId) =>
    api.get(`/api/path/roadmap/${goalId}/days`);

export const getLessonContent = (goalId, dayNumber) =>
    api.get(`/api/path/roadmap/${goalId}/day/${dayNumber}/lesson`);

export const askLessonQuestion = (message, lessonTitle, lessonContent) =>
    api.post("/api/path/chat", { message, lessonTitle, lessonContent });