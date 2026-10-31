import api from "./axiosClient";


export const generateLearningPath = (data) => api.post("/api/path/generate", data);

export const getMyPaths = () => api.get("/api/path/all");