import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../auth/AuthContext";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useContext(AuthContext);
    if (loading) {
        return <div className="text-center mt-20">Loading...</div>;
    }
    if (!user) {
        return <Navigate to="/login" />;
    }
    return children;
}