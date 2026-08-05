import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Entries } from "@/pages/Entries";
import { Insights } from "@/pages/Insights";
import { Login } from "@/pages/Login";
import { Team } from "@/pages/Team";
import { Track } from "@/pages/Track";

export default function App() {
  const { session, member, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="font-display text-2xl text-pine-600">COCO</span>
      </div>
    );
  }

  if (!session || !member) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Track />} />
        {member.is_admin && (
          <>
            <Route path="/insights" element={<Insights />} />
            <Route path="/zeiten" element={<Entries />} />
            <Route path="/team" element={<Team />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
