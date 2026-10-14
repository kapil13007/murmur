// File: src/components/MainLayout.jsx
// Hub frame: sidebar on the cream canvas, pages in a rounded white panel.
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <main className="my-2 mr-2 flex-1 overflow-y-auto rounded-2xl bg-panel shadow-panel">
        <div className="mx-auto w-full max-w-[920px] px-10 pb-16 pt-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
