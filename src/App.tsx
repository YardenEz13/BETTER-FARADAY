import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { preloadModel } from "./services/localAI";
import { ThemeProvider } from "./components/ThemeContext";

// Route-level code splitting — each page ships as its own chunk, so a student
// never downloads the teacher dashboard (and vice versa).
const RolePage           = lazy(() => import("./pages/RolePage"));
const StudentHome        = lazy(() => import("./pages/StudentHome"));
const PracticeSession    = lazy(() => import("./pages/PracticeSession"));
const TeacherDashboard   = lazy(() => import("./pages/TeacherDashboard"));
const StudentHomework    = lazy(() => import("./pages/StudentHomework"));
const StudentHomeworkList = lazy(() => import("./pages/StudentHomeworkList"));
const LearningProgress   = lazy(() => import("./pages/LearningProgress"));
const ElectricGallery    = lazy(() => import("./pages/ElectricGallery")); // dev showcase — safe to remove

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="num text-sm font-semibold text-primary tracking-widest">טוען…</span>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Warm up the AI tutor connection when the app starts
    preloadModel().catch(console.error);
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<RolePage />} />
            <Route path="/student/:studentId" element={<StudentHome />} />
            <Route path="/student/:studentId/practice/:topicId" element={<PracticeSession />} />
            <Route path="/student/:studentId/homework" element={<StudentHomeworkList />} />
            <Route path="/student/:studentId/homework/:homeworkId" element={<StudentHomework />} />
            <Route path="/student/:studentId/progress" element={<LearningProgress />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/electric-demo" element={<ElectricGallery />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Analytics />
      <SpeedInsights />
    </ThemeProvider>
  );
}
