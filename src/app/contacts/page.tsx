"use client";

import { useState, useEffect } from 'react';
import { Upload, Trash2, Search, UserPlus, X, RefreshCw } from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  email: string;
  website: string;
  status: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'multiple'>('single');
  const [newContact, setNewContact] = useState({ name: '', email: '', website: '' });
  const [bulkContacts, setBulkContacts] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      const res = await fetch('/api/contacts', { cache: 'no-store' });
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/contacts/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully uploaded ${data.count} contacts.`);
        fetchContacts();
      } else {
        const errorData = await res.json();
        alert(`Upload failed: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('An error occurred during upload.');
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  }

  async function deleteContact(id: number) {
    if (confirm('Delete this contact?')) {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      fetchContacts();
    }
  }

  async function deleteAllContacts() {
    if (confirm('Are you sure you want to delete ALL contacts? This action cannot be undone.')) {
      await fetch('/api/contacts?all=true', { method: 'DELETE' });
      fetchContacts();
    }
  }

  async function handleAddContact() {
    let payload: { name?: string; email: string; website?: string } | { email: string }[];
    if (addMode === 'single') {
      if (!newContact.email) {
        alert('Email is required.');
        return;
      }
      payload = newContact;
    } else {
      const emails = bulkContacts.split('\n').map(e => e.trim()).filter(e => e.length > 0);
      if (emails.length === 0) {
        alert('Please enter at least one email.');
        return;
      }
      payload = emails.map(email => ({ email }));
    }

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewContact({ name: '', email: '', website: '' });
        setBulkContacts('');
        fetchContacts();
      } else {
        const errorData = await res.json();
        alert(`Failed to add: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Add contact error:', err);
    }
  }

  async function resetContactsStatus() {
    if (confirm('Set all contacts back to "pending"? This will allow you to send emails to them again.')) {
      await fetch('/api/contacts/reset', { method: 'POST' });
      fetchContacts();
    }
  }

  const filteredContacts = contacts.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Contacts</h2>
          <p className="text-gray-600">Manage your leads and upload CSV lists.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={deleteAllContacts}
            className="flex items-center px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </button>
          <button 
            onClick={resetContactsStatus}
            className="flex items-center px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Status
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Contact
          </button>
          <label className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Add Contacts</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setAddMode('single')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition ${addMode === 'single' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Single
                </button>
                <button 
                  onClick={() => setAddMode('multiple')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition ${addMode === 'multiple' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Multiple
                </button>
              </div>

              {addMode === 'single' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="John Doe"
                      value={newContact.name}
                      onChange={e => setNewContact({...newContact, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input 
                      type="email" 
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="john@example.com"
                      value={newContact.email}
                      onChange={e => setNewContact({...newContact, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="https://example.com"
                      value={newContact.website}
                      onChange={e => setNewContact({...newContact, website: e.target.value})}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emails (one per line)</label>
                  <textarea 
                    className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-500 h-40"
                    placeholder="john@example.com&#10;jane@example.com"
                    value={bulkContacts}
                    onChange={e => setBulkContacts(e.target.value)}
                  />
                </div>
              )}

              <button 
                onClick={handleAddContact}
                className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Add Contact{addMode === 'multiple' ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center">
          <Search className="w-5 h-5 text-gray-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            className="flex-1 outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Website</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{contact.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contact.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contact.website || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      contact.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => deleteContact(contact.id)}
                      className="text-red-500 hover:text-red-700 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No contacts found. Upload a CSV to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
