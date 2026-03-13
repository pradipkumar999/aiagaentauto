"use client";

import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    gemini_api_key: '',
    gemini_model: 'gemini-1.5-flash',
    daily_email_limit: 50,
    default_tone: 'friendly'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [models, setModels] = useState<{name: string, displayName: string}[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchModels = useCallback(async (apiKey: string) => {
    if (!apiKey) return;
    setIsFetchingModels(true);
    try {
      const res = await fetch('/api/gemini/models', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setModels(data);
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      if (data) {
        setSettings(prev => ({ 
          ...prev, 
          ...data
        }));
        if (data.gemini_api_key) {
          fetchModels(data.gemini_api_key);
        }
      }
    });
  }, [fetchModels]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    const res = await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: 'Failed to save settings: ' + (data.error || "Unknown error") });
    }
    setIsSaving(false);
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-600">Configure your AI and General parameters.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2 text-blue-600" /> AI Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Gemini API Key</label>
              <div className="flex gap-2 mt-1">
                <input 
                  type="password" 
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  value={settings.gemini_api_key || ''}
                  onChange={e => setSettings({ ...settings, gemini_api_key: e.target.value })}
                />
                <button 
                  type="button"
                  onClick={() => fetchModels(settings.gemini_api_key)}
                  disabled={isFetchingModels || !settings.gemini_api_key}
                  className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {isFetchingModels ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Fetch Models
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Selected Model</label>
              <select 
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                value={settings.gemini_model || ''}
                onChange={e => setSettings({ ...settings, gemini_model: e.target.value })}
              >
                {/* Always include current model if it's not in the list */}
                {settings.gemini_model && !models.find(m => m.name === settings.gemini_model) && (
                  <option value={settings.gemini_model}>{settings.gemini_model}</option>
                )}
                
                {models.length > 0 ? (
                  models.map(m => (
                    <option key={m.name} value={m.name}>{m.displayName} ({m.name})</option>
                  ))
                ) : (
                  !settings.gemini_model && <option value="">No models fetched yet...</option>
                )}
              </select>
              <p className="mt-1 text-xs text-gray-500">Note: <b>gemini-1.5-flash</b> is recommended for speed. Use Fetch Models to see more.</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2 text-purple-600" /> General Limits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Daily Email Limit</label>
              <input 
                type="number" 
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                value={settings.daily_email_limit || ''}
                onChange={e => setSettings({ ...settings, daily_email_limit: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Default Tone</label>
              <select 
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                value={settings.default_tone || 'friendly'}
                onChange={e => setSettings({ ...settings, default_tone: e.target.value })}
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSaving}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? 'Saving...' : 'Save All Settings'}
        </button>
      </form>
    </div>
  );
}
