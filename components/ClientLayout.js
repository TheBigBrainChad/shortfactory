'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import ToastContainer, { showToast } from './Toast';

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (isLogin) {
      setAuthed(true);
      return;
    }
    fetch('/api/settings')
      .then(r => {
        if (r.ok || r.status === 200) {
          setAuthed(true);
        } else {
          router.replace('/login');
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [pathname, isLogin, router]);

  if (!authed && !isLogin) return null;

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={pathname} />
      <main className="main-content">
        <div className="page-container stagger-children">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}