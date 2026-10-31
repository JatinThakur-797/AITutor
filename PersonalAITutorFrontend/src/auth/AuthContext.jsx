import { createContext, useEffect, useState } from "react";
import { getMe } from "../api/authApi";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    async function loadUser() {
        const token = localStorage.getItem("access_token");
        
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const res = await getMe();
            console.log(res);
            setUser(res.data);
        } catch {
            setUser(null);
            localStorage.removeItem("access_token");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, setUser, loadUser }}>
            {children}
        </AuthContext.Provider>
    );
};