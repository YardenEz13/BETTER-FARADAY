import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ElectricLoader } from "./components/electric";
import PageTransition from "./components/PageTransition";
import FaradayProvider from "./components/chat/FaradayProvider";
import AppErrorBoundary from "./components/AppErrorBoundary";
import ErrorToaster from "./components/ErrorToaster";

// Route-level code splitting — each page ships as its own chunk, so a student
// never downloads the teacher dashboard (and vice versa).
const RolePage           = lazy(() => import("./pages/RolePage"));
const StudentHome        = lazy(() => import("./pages/StudentHome"));
const Onboarding         = lazy(() => import("./pages/Onboarding"));
const PracticeSession    = lazy(() => import("./pages/PracticeSession"));
const TeacherDashboard   = lazy(() => import("./pages/TeacherDashboard"));
const StudentHomework    = lazy(() => import("./pages/StudentHomework"));
const StudentHomeworkList = lazy(() => import("./pages/StudentHomeworkList"));
const StudentPdfAssignment = lazy(() => import("./pages/StudentPdfAssignment"));
const LearningProgress   = lazy(() => import("./pages/LearningProgress"));
const XpShop             = lazy(() => import("./pages/XpShop"));
const ReviewDeck         = lazy(() => import("./pages/ReviewDeck"));
const Leaderboard        = lazy(() => import("./pages/Leaderboard"));
const ExamMode           = lazy(() => import("./pages/ExamMode"));
const DesignGallery      = import.meta.env.DEV ? lazy(() => import("./pages/DesignGallery")) : null; // dev-only styleguide
const MobileBridgeUpload = lazy(() => import("./pages/MobileBridgeUpload"));
const ParentReport       = lazy(() => import("./pages/ParentReport"));
const PacketReviewPage   = lazy(() => import("./pages/PacketReviewPage"));
const HomeworkCreateWizard = lazy(() => import("./pages/HomeworkCreateWizard"));
const Legal              = lazy(() => import("./pages/Legal"));

function RouteFallback() {
  return <ElectricLoader label="טוען…" />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        {/* Single mount of the Faraday tutor — screens open it via useFaraday() */}
        <FaradayProvider>
          <AnimatedRoutes />
        </FaradayProvider>
      </BrowserRouter>
      <ErrorToaster />
      <Analytics />
      <SpeedInsights />
    </AppErrorBoundary>
  );
}

/**
 * Routes keyed by location so each route change remounts through
 * PageTransition's enter animation (clay slide+fade). Enter-only — exit
 * animations deadlock with lazy routes + Suspense (see PageTransition).
 */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <PageTransition key={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
            <Route path="/" element={<RolePage />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/student/:studentId" element={<StudentHome />} />
            <Route path="/student/:studentId/welcome" element={<Onboarding />} />
            <Route path="/student/:studentId/practice/:topicId" element={<PracticeSession />} />
            <Route path="/student/:studentId/homework" element={<StudentHomeworkList />} />
            <Route path="/student/:studentId/homework/:homeworkId" element={<StudentHomework />} />
            <Route path="/student/:studentId/pdf/:assignmentId" element={<StudentPdfAssignment />} />
            <Route path="/student/:studentId/progress" element={<LearningProgress />} />
            <Route path="/student/:studentId/shop" element={<XpShop />} />
            <Route path="/student/:studentId/review" element={<ReviewDeck />} />
            <Route path="/student/:studentId/leaderboard" element={<Leaderboard />} />
            <Route path="/student/:studentId/exam" element={<ExamMode />} />
            <Route path="/student/:studentId/exam/:examId" element={<ExamMode />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/homework/new" element={<HomeworkCreateWizard />} />
            <Route path="/teacher/homework/:homeworkId/edit" element={<HomeworkCreateWizard />} />
            <Route path="/teacher/packet/:packetId" element={<PacketReviewPage />} />
            {DesignGallery && <Route path="/design" element={<DesignGallery />} />}
            <Route path="/bridge/:token" element={<MobileBridgeUpload />} />
            <Route path="/parent/:token" element={<ParentReport />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}
