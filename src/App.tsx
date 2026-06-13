import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import RolePage from "./pages/RolePage";
import StudentHome from "./pages/StudentHome";
import PracticeSession from "./pages/PracticeSession";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentHomework from "./pages/StudentHomework";
import StudentHomeworkList from "./pages/StudentHomeworkList";
import LearningProgress from "./pages/LearningProgress";
import { preloadModel } from "./services/localAI";
import { ThemeProvider } from "./components/ThemeContext";

export default function App() {
  useEffect(() => {
    // Auto-load AI model when the app starts
    preloadModel().catch(console.error);
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RolePage />} />
          <Route path="/student/:studentId" element={<StudentHome />} />
          <Route path="/student/:studentId/practice/:topicId" element={<PracticeSession />} />
          <Route path="/student/:studentId/homework" element={<StudentHomeworkList />} />
          <Route path="/student/:studentId/homework/:homeworkId" element={<StudentHomework />} />
          <Route path="/student/:studentId/progress" element={<LearningProgress />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <SpeedInsights />
    </ThemeProvider>
  );
}

