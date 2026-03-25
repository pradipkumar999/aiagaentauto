"use client";

import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Loader2, Server } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    claude_model: 'phi3:mini',
    daily_email_limit: 50,
    default_tone: 'friendly'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [models, setModels] = useState<{name: string, displayName: string}[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetch('/api/claude/models', {
        method: 'POST',
        body: JSON.stringify({}),
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
          claude_model: data.gemini_model || prev.claude_model,
          daily_email_limit: data.daily_email_limit ?? prev.daily_email_limit,
          default_tone: data.default_tone || prev.default_tone,
        }));
      }
    });
    // Auto-fetch models on load
    fetchModels();
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
          <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center">
            <Server className="w-5 h-5 mr-2 text-blue-600" /> VPS AI Configuration
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Using self-hosted VPS model at <code className="bg-gray-100 px-1 rounded">http://62.171.155.215/api/generate</code>
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Select Model</label>
              <div className="flex gap-2 mt-1">
                <select
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  value={settings.claude_model || ''}
                  onChange={e => setSettings({ ...settings, claude_model: e.target.value })}
                >
                  {settings.claude_model && !models.find(m => m.name === settings.claude_model) && (
                    <option value={settings.claude_model}>{settings.claude_model}</option>
                  )}
                  {models.length > 0 ? (
                    models.map(m => (
                      <option key={m.name} value={m.name}>{m.displayName}</option>
                    ))
                  ) : (
                    !settings.claude_model && <option value="">Click &quot;Refresh Models&quot; to load...</option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={fetchModels}
                  disabled={isFetchingModels}
                  className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {isFetchingModels ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh Models
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Models are fetched directly from your VPS Ollama instance.</p>
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
