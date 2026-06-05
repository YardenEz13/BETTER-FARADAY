import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import RolePage from "./pages/RolePage";
import StudentHome from "./pages/StudentHome";
import PracticeSession from "./pages/PracticeSession";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentHomework from "./pages/StudentHomework";
import StudentHomeworkList from "./pages/StudentHomeworkList";
import { preloadModel } from "./services/localAI";

export default function App() {
  useEffect(() => {
    // Auto-load AI model when the app starts
    preloadModel().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RolePage />} />
        <Route path="/student/:studentId" element={<StudentHome />} />
        <Route path="/student/:studentId/practice/:topicId" element={<PracticeSession />} />
        <Route path="/student/:studentId/homework" element={<StudentHomeworkList />} />
        <Route path="/student/:studentId/homework/:homeworkId" element={<StudentHomework />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
