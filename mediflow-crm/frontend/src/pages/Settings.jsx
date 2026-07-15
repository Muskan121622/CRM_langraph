import { useState } from 'react';
import { User, Bell, Shield, Moon, Monitor, Mic, Globe, Save } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="p-8 h-screen overflow-y-auto bg-gray-50 flex justify-center">
      <div className="max-w-4xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-2">Manage your account and application preferences.</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 shrink-0 space-y-1">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <User className="w-5 h-5" /> Profile Settings
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'ai' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Mic className="w-5 h-5" /> AI Agent Preferences
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Bell className="w-5 h-5" /> Notifications
            </button>
            <button 
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Monitor className="w-5 h-5" /> Appearance
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Profile Settings</h2>
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold border-4 border-white shadow-md">
                    JS
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Change Avatar</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border bg-gray-50" defaultValue="Jane" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border bg-gray-50" defaultValue="Smith" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input type="email" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border bg-gray-50" defaultValue="jane.smith@mediflow.com" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Territory</label>
                    <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border bg-gray-50" defaultValue="North India Region" />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">AI Agent Preferences</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Auto-Suggest Follow-ups</h4>
                      <p className="text-xs text-gray-500 mt-1">AI will automatically generate 3 contextual follow-up tasks.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Sentiment Analysis Tool</h4>
                      <p className="text-xs text-gray-500 mt-1">Enable LangGraph sentiment extraction from voice notes.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Voice Transcription Engine</h4>
                      <p className="text-xs text-gray-500 mt-1">Default language for medical transcription.</p>
                    </div>
                    <select className="text-sm border-gray-300 rounded-lg p-2 bg-gray-50 focus:ring-blue-500 focus:border-blue-500">
                      <option>English (US)</option>
                      <option>English (UK)</option>
                      <option>Hindi</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            {(activeTab === 'notifications' || activeTab === 'appearance') && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center h-64">
                <Shield className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-900">More settings coming soon</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-2">We're constantly adding new ways to customize your MediFlow CRM experience.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
