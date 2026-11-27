import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { BackupModal } from './components/BackupModal';
import { ProfileModal } from './components/ProfileModal';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { ToastContainer } from './components/ToastContainer';
import { DigitalCardPage } from './pages/DigitalCardPage';
import { EditorPage } from './pages/EditorPage';
import { ExportPage } from './pages/ExportPage';
import { HomePage } from './pages/HomePage';
import { PhygitalPage } from './pages/PhygitalPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { WorksPage } from './pages/WorksPage';
import { useStudioStore } from './stores/useStudioStore';

export function App() {
  const init = useStudioStore((s) => s.init);
  const [backupOpen, setBackupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-[#F9FAFB]">
        <SiteHeader
          onOpenBackup={() => setBackupOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
        />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage onOpenBackup={() => setBackupOpen(true)} />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/works" element={<WorksPage onOpenBackup={() => setBackupOpen(true)} />} />
            <Route path="/phygital" element={<PhygitalPage />} />
            <Route path="/card" element={<DigitalCardPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="*" element={<HomePage onOpenBackup={() => setBackupOpen(true)} />} />
          </Routes>
        </main>

        <SiteFooter />
        <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
        <ToastContainer />
      </div>
    </HashRouter>
  );
}
export default App;
