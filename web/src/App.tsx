import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
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

function AppShell() {
  const location = useLocation();
  const [backupOpen, setBackupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isWorkspaceOrCard =
    location.pathname.startsWith('/editor') ||
    location.pathname.startsWith('/phygital') ||
    location.pathname.startsWith('/export') ||
    location.pathname.startsWith('/card');

  return (
    <div className="min-h-screen flex flex-col">
      {!isWorkspaceOrCard && (
        <SiteHeader
          onOpenBackup={() => setBackupOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
        />
      )}

      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage onOpenBackup={() => setBackupOpen(true)} />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/works" element={<WorksPage onOpenBackup={() => setBackupOpen(true)} onOpenProfile={() => setProfileOpen(true)} />} />
          <Route path="/editor" element={<EditorPage onOpenBackup={() => setBackupOpen(true)} />} />
          <Route path="/phygital" element={<PhygitalPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/card" element={<DigitalCardPage />} />
          <Route path="*" element={<HomePage onOpenBackup={() => setBackupOpen(true)} />} />
        </Routes>
      </main>

      {!isWorkspaceOrCard && <SiteFooter onOpenBackup={() => setBackupOpen(true)} />}

      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ToastContainer />
    </div>
  );
}

export function App() {
  const init = useStudioStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

export default App;
