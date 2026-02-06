import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { BannerProvider } from "./context/BannerContext";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import WaitingRoom from "./pages/WaitingRoom";
import LoginForm from "./components/auth/LoginForm";

import AuthPage from "./components/auth/AuthPage";
import GameLobby from "./pages/GameLobby";
import Friends from "./pages/Friends";
import CashierRoom from "./pages/CashierRoom";
import CashierApproval from "./pages/CashierApproval";
import PlayerPendingApproval from "./pages/PlayerPendingApproval";
import PlayingRoom from "./pages/PlayingRoom";
import FriendsWaitingRoom from "./pages/FriendsWaitingRoom";
import GamesList from "./pages/GamesList";
import WalletModal from "./components/WalletModal";
import ProfileModal from "./components/ProfileModal";
import InviteModal from "./components/InviteModal";
import BingoGame from "./example";
import SpinPage from "./pages/SpinPage";
import TestAudioComponent from "./components/TestAudioComponent";
import TokenLogin from "./pages/TokenLogin";

function App() {
  return (
    <AuthProvider>
      <BannerProvider>
        <Router>
          <WalletModal />
          <ProfileModal />
          <InviteModal />
          <Routes>
          <Route path="/example" element={<BingoGame />} />
          <Route path="/test-audio" element={<TestAudioComponent />} />
          {/* <Route path="/" element={<GamesList />} /> */}
          <Route path="/bingo" element={<HomePage />} />
          <Route
            path="/systemGames"
            element={
              <ProtectedRoute>
                <GameLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiting/:gameRoomId"
            element={
              <ProtectedRoute>
                <WaitingRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playing/:gameRoomId"
            element={
              <ProtectedRoute>
                <PlayingRoom />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Friends />} />
          <Route
            path="/cashier/:cashierId"
            element={
              <ProtectedRoute>
                <CashierRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/approval/:roomId"
            element={
              <ProtectedRoute>
                <CashierApproval />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending/:roomId"
            element={
              <ProtectedRoute>
                <PlayerPendingApproval />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends/waiting/:roomid"
            element={
              <ProtectedRoute>
                <FriendsWaitingRoom />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/token-login" element={<TokenLogin />} />
          <Route
            path="/spin"
            element={
              <ProtectedRoute>
                <SpinPage />
              </ProtectedRoute>
            }
          />
          </Routes>
        </Router>
      </BannerProvider>
    </AuthProvider>
  );
}

export default App;
