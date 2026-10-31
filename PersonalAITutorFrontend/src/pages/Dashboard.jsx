import { useContext, useEffect, useState } from "react";
import { logout } from "../api/authApi";
import { generateLearningPath, getMyPaths } from "../api/pathApi";
import { AuthContext } from "../auth/AuthContext";

export default function Dashboard() {
    const { user } = useContext(AuthContext);

    // --- STATE MANAGEMENT ---
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]); // Stores list of past paths
    const [selectedPath, setSelectedPath] = useState(null); // Stores the currently visible path
    const [error, setError] = useState("");

    // Form Data State
    const [formData, setFormData] = useState({
        currentSkills: "",
        careerGoal: "",
        learningStyle: "Visual",
        difficultyLevel: "Beginner",
        preferredDuration: ""
    });

    // --- INITIALIZATION ---
    // Load history when the component mounts
    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        try {
            const res = await getMyPaths();
            // The backend returns a list of LearningPath objects
            // We need to reverse it to show the newest first
            setHistory(res.data.reverse());
        } catch (err) {
            console.error("Failed to load history", err);
        }
    }

    // --- ACTIONS ---

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    async function handleLogout() {
        await logout();
        localStorage.removeItem("access_token");
        window.location.href = "/login";
    }

    // When clicking a history item in the sidebar
    function handleHistoryClick(item) {
        try {
            // The 'content' field from backend is a JSON string, so we parse it
            const parsedContent = JSON.parse(item.content);
            setSelectedPath(parsedContent);
        } catch (e) {
            console.error("Error parsing path content", e);
            alert("Error loading this path.");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSelectedPath(null); // Clear current view while loading

        try {
            // 1. Send data to AI
            const res = await generateLearningPath(formData);

            // 2. Parse the result
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            setSelectedPath(data);

            // 3. Refresh history to show the new item in sidebar
            loadHistory();

        } catch (err) {
            console.error(err);
            setError("Failed to generate path. API Gateway or AI Service might be down.");
        } finally {
            setLoading(false);
        }
    }

    // --- UI RENDERING ---

    return (
        <div className="min-h-screen flex bg-gray-100">

            {/* --- SIDEBAR (HISTORY) --- */}
            <aside className="w-64 bg-white shadow-xl flex flex-col z-10">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-blue-600 flex items-center gap-2">
                        <span>🚀</span> My Paths
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <button
                        onClick={() => setSelectedPath(null)}
                        className="w-full text-left p-3 rounded-lg border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition flex items-center gap-2"
                    >
                        <span>+</span> New Path
                    </button>

                    {history.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => handleHistoryClick(item)}
                            className="p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 hover:shadow-sm transition"
                        >
                            <h4 className="font-semibold text-gray-800 text-sm">{item.careerGoal}</h4>
                            <div className="flex justify-between mt-1">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.difficultyLevel}</span>
                                <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
                            <button onClick={handleLogout} className="text-xs text-red-500 hover:underline">Logout</button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 overflow-y-auto p-8">

                {/* 1. WELCOME HEADER (Only show if creating new path) */}
                {!selectedPath && !loading && (
                    <div className="max-w-3xl mx-auto mb-8 text-center">
                        <h1 className="text-4xl font-bold text-gray-800 mb-2">Build Your Career Path</h1>
                        <p className="text-gray-600">AI-powered roadmaps tailored to your learning style.</p>
                    </div>
                )}

                {/* 2. LOADING STATE */}
                {loading && (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium animate-pulse">Consulting AI Mentor...</p>
                    </div>
                )}

                {/* 3. INPUT FORM (Show if no path selected) */}
                {!selectedPath && !loading && (
                    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Current Skills</label>
                                    <input name="currentSkills" value={formData.currentSkills} onChange={handleChange} placeholder="e.g. Java, HTML" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Career Goal</label>
                                    <input name="careerGoal" value={formData.careerGoal} onChange={handleChange} placeholder="e.g. Full Stack Developer" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Learning Style</label>
                                    <select name="learningStyle" value={formData.learningStyle} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg bg-white">
                                        <option>Visual</option>
                                        <option>Reading</option>
                                        <option>Youtube</option>
                                        <option>Docs</option>
                                        <option>Hands-on</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty</label>
                                    <select name="difficultyLevel" value={formData.difficultyLevel} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg bg-white">
                                        <option>Beginner</option>
                                        <option>Intermediate</option>
                                        <option>Advanced</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Duration</label>
                                    <input name="preferredDuration" value={formData.preferredDuration} onChange={handleChange} placeholder="e.g. 4 weeks" className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500" required />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition duration-200">
                                Generate Roadmap ⚡
                            </button>
                        </form>
                    </div>
                )}

                {/* 4. RESULT DISPLAY (The Roadmap) */}
                {selectedPath && !loading && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
                        {/* Title Card */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                            <h1 className="text-3xl font-bold text-gray-900">{selectedPath.title}</h1>
                            <p className="mt-2 text-gray-600 leading-relaxed">{selectedPath.overview}</p>
                        </div>

                        {/* Weeks Grid */}
                        <div className="grid gap-6">
                            {selectedPath.weeks?.map((week, index) => (
                                <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg text-sm">
                                            Week {week.weekNumber}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-800">{week.topic}</h3>
                                    </div>
                                    <p className="text-gray-600 mb-4">{week.description}</p>

                                    {week.resources && week.resources.length > 0 && (
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Recommended Resources</span>
                                            <ul className="space-y-1">
                                                {week.resources.map((res, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-blue-600">
                                                        <span>•</span>
                                                        <a href={res} className="hover:underline">{res}</a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}