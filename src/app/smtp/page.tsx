"use client";

import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, CheckCircle2, XCircle, Shield, ShieldOff, Loader2, Edit2 } from 'lucide-react';

interface SMTP {
  id: number;
  host: string;
  port: number;
  user: string;
  pass?: string;
  from_name: string;
  from_email: string;
  secure: number;
  is_active: number;
}

export default function SMTPPage() {
  const [smtps, setSmtps] = useState<SMTP[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<SMTP | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    host: '',
    port: 465,
    user: '',
    pass: '',
    from_name: '',
    from_email: '',
    secure: true
  });

  useEffect(() => {
    fetchSMTPs();
  }, []);

  async function fetchSMTPs() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/smtps');
      const data = await res.json();
      setSmtps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch SMTPs:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(smtp: SMTP) {
    setEditingSmtp(smtp);
    setFormData({
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      pass: '', // Password not fetched for security, must be re-entered or kept same if API handles it
      from_name: smtp.from_name || '',
      from_email: smtp.from_email,
      secure: smtp.secure === 1
    });
    setIsAdding(true);
  }

  function resetForm() {
    setIsAdding(false);
    setEditingSmtp(null);
    setFormData({ host: '', port: 465, user: '', pass: '', from_name: '', from_email: '', secure: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = '/api/smtps';
      const method = editingSmtp ? 'PUT' : 'POST';
      const body = editingSmtp ? { ...formData, id: editingSmtp.id } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        fetchSMTPs();
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${editingSmtp ? 'update' : 'add'} SMTP`);
      }
    } catch (err) {
      console.error('SMTP submit error:', err);
    }
  }

  async function toggleStatus(id: number, currentStatus: number) {
    try {
      await fetch('/api/smtps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: currentStatus === 1 ? 0 : 1 }),
      });
      fetchSMTPs();
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  }

  async function deleteSMTP(id: number) {
    if (confirm('Are you sure you want to delete this SMTP?')) {
      try {
        await fetch(`/api/smtps?id=${id}`, { method: 'DELETE' });
        fetchSMTPs();
      } catch (err) {
        console.error('Delete SMTP error:', err);
      }
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">SMTP Configurations</h2>
          <p className="text-gray-600">Add and manage multiple SMTP servers for sending emails.</p>
        </div>
        <button 
          onClick={() => {
            if (isAdding) resetForm();
            else setIsAdding(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Add SMTP</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 max-w-2xl animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{editingSmtp ? 'Edit SMTP' : 'Add New SMTP'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
                <input 
                  type="text" required 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="smtp.gmail.com"
                  value={formData.host}
                  onChange={e => setFormData({ ...formData, host: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">SMTP Port</label>
                <input 
                  type="number" required 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="465"
                  value={formData.port}
                  onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">User / Username</label>
                <input 
                  type="text" required 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  value={formData.user}
                  onChange={e => setFormData({ ...formData, user: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password / App Password {editingSmtp && <span className="text-xs text-gray-400 font-normal">(Leave blank to keep same)</span>}</label>
                <input 
                  type="password" required={!editingSmtp}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  value={formData.pass}
                  onChange={e => setFormData({ ...formData, pass: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">From Name</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Marketing Team"
                  value={formData.from_name}
                  onChange={e => setFormData({ ...formData, from_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">From Email</label>
                <input 
                  type="email" required 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="team@example.com"
                  value={formData.from_email}
                  onChange={e => setFormData({ ...formData, from_email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="secure"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.secure}
                onChange={e => setFormData({ ...formData, secure: e.target.checked })}
              />
              <label htmlFor="secure" className="ml-2 text-sm text-gray-700">Use Secure Connection (SSL/TLS)</label>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
              {editingSmtp ? 'Update SMTP Configuration' : 'Save SMTP Configuration'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {smtps.map((smtp) => (
            <div key={smtp.id} className={`bg-white p-6 rounded-xl shadow-sm border ${smtp.is_active ? 'border-blue-100' : 'border-gray-100 opacity-75'} transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${smtp.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Mail className="w-6 h-6" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleStatus(smtp.id, smtp.is_active)}
                    title={smtp.is_active ? "Deactivate" : "Activate"}
                    className={`p-1 transition ${smtp.is_active ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {smtp.is_active ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => handleEdit(smtp)}
                    title="Edit"
                    className="text-blue-500 hover:text-blue-700 p-1"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => deleteSMTP(smtp.id)}
                    title="Delete"
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{smtp.host}:{smtp.port}</h3>
              <p className="text-sm text-gray-500 mb-4">{smtp.user}</p>
              
              <div className="space-y-2 pt-4 border-t border-gray-50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">From:</span>
                  <span className="font-medium text-gray-900">{smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-500">Security:</span>
                  <span className="flex items-center gap-1 font-medium text-gray-900">
                    {smtp.secure ? <><Shield className="w-3 h-3 text-green-500" /> SSL/TLS</> : <><ShieldOff className="w-3 h-3 text-gray-400" /> Plain</>}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {smtps.length === 0 && !isAdding && (
            <div className="col-span-full py-20 text-center text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">No SMTP configurations added yet.</p>
              <p className="text-sm">Click &quot;Add SMTP&quot; to start sending emails.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
