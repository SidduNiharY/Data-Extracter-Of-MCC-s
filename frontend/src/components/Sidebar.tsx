'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Activity, FileBarChart, Settings, Zap } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Pull Jobs', href: '/pulls', icon: Activity },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    { name: 'Settings', href: '#', icon: Settings },
  ];

  return (
    <aside style={{
      width: '260px',
      borderRight: '1px solid var(--surface-border)',
      background: 'var(--bg-secondary)',
      padding: 'var(--space-5) var(--space-4)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Logo */}
      <div style={{ 
        marginBottom: 'var(--space-10)', 
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: '0 var(--space-3)'
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(59,130,246,0.3)'
        }}>
          <Zap color="white" size={18} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-gradient">SuperMatrix</h1>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em' }}>DATA PLATFORM</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 var(--space-3)', marginBottom: 'var(--space-2)' }}>
          NAVIGATION
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/');
          
          return (
            <Link key={link.name} href={link.href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: '0.6rem var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: isActive ? 'rgba(59,130,246,0.08)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              fontWeight: isActive ? 500 : 400,
              fontSize: '0.875rem',
              position: 'relative'
            }}>
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 16, borderRadius: '0 4px 4px 0',
                  background: 'var(--accent-gradient)'
                }} />
              )}
              <Icon size={18} color={isActive ? "var(--accent-blue)" : "var(--text-muted)"} strokeWidth={isActive ? 2 : 1.5} />
              {link.name}
            </Link>
          );
        })}
      </nav>

      {/* Status Card */}
      <div style={{
        marginTop: 'auto',
        padding: 'var(--space-4)',
        background: 'linear-gradient(145deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 100%)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(16,185,129,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} className="animate-pulse" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--status-success)' }}>System Online</span>
        </div>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>All APIs are operational</span>
      </div>
    </aside>
  );
}
