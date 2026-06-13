import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import RolePage from "./pages/RolePage";
import StudentHome from "./pages/StudentHome";
import PracticeSession from "./pages/PracticeSession";
import StudentHomeworkList from "./pages/StudentHomeworkList";
import StudentHomework from "./pages/StudentHomework";
import AIChatAnalyticsView from "./pages/AIChatAnalyticsView";
import TeacherDashboard from "./pages/TeacherDashboard";
import HomeworkManagementView from "./pages/HomeworkManagementView";
import HeatmapView from "./pages/HeatmapView";
import StudentPowerMapView from "./pages/StudentPowerMapView";
import { ThemeProvider } from "./components/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RolePage />} />
          <Route path="/student/:studentId" element={<StudentHome />} />
          <Route path="/student/:studentId/practice/:topicId" element={<PracticeSession />} />
          <Route path="/student/:studentId/homework" element={<StudentHomeworkList />} />
          <Route path="/student/:studentId/homework/:homeworkId" element={<StudentHomework />} />
          
          <Route path="/teacher/:classroomId" element={<TeacherDashboard />} />
          <Route path="/teacher/:classroomId/homework/:homeworkId" element={<HomeworkManagementView />} />
          <Route path="/teacher/:classroomId/analytics/chat/:chatId" element={<AIChatAnalyticsView />} />
          <Route path="/teacher/:classroomId/heatmap" element={<HeatmapView />} />
          <Route path="/teacher/:classroomId/power-map/:studentId" element={<StudentPowerMapView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Analytics />
      <SpeedInsights />
    </ThemeProvider>
  );
}
