import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import ComparePage from "@/pages/Compare";
import BatchPage from "@/pages/Batch";
import GlossaryPage from "@/pages/Glossary";
import GuidePage from "@/pages/Guide";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ComparePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" theme="dark" duration={2500} />
    </div>
  );
}

export default App;
