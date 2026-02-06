import { useAuth } from "../context/AuthContext";
import NameInputModal from "./NameInputModal";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, setLocalPlayer } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
          <p className="text-sky-200/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Show name input modal for players to enter their name
    return (
      <NameInputModal
        onSubmit={(name) => {
          setLocalPlayer(name);
        }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;
