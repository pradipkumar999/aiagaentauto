"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Mail, 
  Inbox, 
  Users, 
  Settings,
  LogOut,
  ShieldCheck
} from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { name: 'Affiliate Products', icon: ShoppingBag, href: '/products' },
    { name: 'Email Campaign', icon: Mail, href: '/campaigns' },
    { name: 'SMTP', icon: Mail, href: '/smtp' },
    { name: 'Domain Health', icon: ShieldCheck, href: '/health' },
    { name: 'Inbox', icon: Inbox, href: '/inbox' },
    { name: 'Contacts', icon: Users, href: '/contacts' },
    { name: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-800">Affiliate AI Agent</h1>
        </div>
        <nav className="mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-6 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors rounded-lg"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
