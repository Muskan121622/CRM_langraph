import { NavLink } from 'react-router-dom';
import { Home, MessageSquarePlus, History, Calendar, BarChart3, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const links = [
    { name: 'Dashboard', to: '/', icon: Home },
    { name: 'Log Interaction', to: '/log', icon: MessageSquarePlus },
    { name: 'HCP History', to: '/history', icon: History },
    { name: 'Follow-ups', to: '/followups', icon: Calendar },
    { name: 'Analytics', to: '/analytics', icon: BarChart3 },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r h-screen flex flex-col fixed shadow-sm">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
          MediFlow AI CRM
        </h1>
        <p className="text-xs text-gray-500 mt-1">AI-First Assistant</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <link.icon className="w-5 h-5" />
            {link.name}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
            MR
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Medical Rep</p>
          </div>
        </div>
      </div>
    </div>
  );
}
