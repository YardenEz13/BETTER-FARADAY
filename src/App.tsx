import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RolePage from "./pages/RolePage";
import StudentHome from "./pages/StudentHome";
import PracticeSession from "./pages/PracticeSession";
import TeacherDashboard from "./pages/TeacherDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div className="mesh-bg" />
      <Routes>
        <Route path="/" element={<RolePage />} />
        <Route path="/student/:studentId" element={<StudentHome />} />
        <Route path="/student/:studentId/practice/:topicId" element={<PracticeSession />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
