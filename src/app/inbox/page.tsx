"use client";

import { useState, useEffect } from 'react';
import { Mail, User, Calendar, RefreshCw, MessageSquare } from 'lucide-react';

interface Email {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string;
  subject: string;
  content: string;
  sent_at: string;
}

interface Reply {
  id: number;
  contact_id: number;
  email_id: number | null;
  message: string;
  received_at: string;
}

interface ConversationItem {
  id: number;
  message: string;
  is_incoming: boolean;
  timestamp: string;
}

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [replies, setReplies] = useState<ConversationItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  async function fetchEmails() {
    const res = await fetch('/api/inbox');
    const data = await res.json();
    setEmails(data);
  }

  useEffect(() => {
    if (selectedEmail) {
      fetchReplies(selectedEmail.id, selectedEmail.contact_id);
    }
  }, [selectedEmail]);

  async function fetchReplies(emailId: number, contactId: number) {
    const res = await fetch(`/api/inbox/replies?contactId=${contactId}`);
    const incomingReplies = await res.json() as Reply[];
    
    const resSent = await fetch(`/api/inbox/sent?contactId=${contactId}`);
    const sentEmails = await resSent.json() as Email[];

    const conversation: ConversationItem[] = [
      ...incomingReplies.map((r) => ({ id: r.id, message: r.message, is_incoming: true, timestamp: r.received_at })),
      ...sentEmails.filter((e) => e.id !== emailId).map((e) => ({ id: e.id, message: e.content, is_incoming: false, timestamp: e.sent_at }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    setReplies(conversation);
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/inbox/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Synced! ${data.count} new replies found and ${data.followUps} follow-ups sent.`);
        fetchEmails();
        if (selectedEmail) fetchReplies(selectedEmail.id, selectedEmail.contact_id);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex h-full -m-8">
      {/* Email List */}
      <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Sent Outreach</h2>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
            title="Sync Replies"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {emails.map((email) => (
            <div 
              key={email.id} 
              onClick={() => setSelectedEmail(email)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedEmail?.id === email.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-gray-900 truncate">{email.contact_name}</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(email.sent_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-gray-600 font-medium truncate mb-1">{email.subject}</div>
              <div className="text-xs text-gray-400 truncate">{email.content}</div>
            </div>
          ))}
          {emails.length === 0 && (
            <div className="p-8 text-center text-gray-400 italic">No emails sent yet.</div>
          )}
        </div>
      </div>

      {/* Email Detail */}
      <div className="flex-1 bg-gray-50 overflow-y-auto p-8">
        {selectedEmail ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
            <header className="mb-8 pb-8 border-b border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedEmail.subject}</h2>
              </div>
              <div className="flex items-center text-sm text-gray-600 space-x-6">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  To: <span className="ml-1 font-medium text-gray-900">{selectedEmail.contact_name} ({selectedEmail.contact_email})</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  Sent: <span className="ml-1">{new Date(selectedEmail.sent_at).toLocaleString()}</span>
                </div>
              </div>
            </header>
            
            <div className="prose prose-blue max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed mb-12">
              {selectedEmail.content}
            </div>
            
            <div className="mt-12 pt-8 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Replies
              </h3>
              
              <div className="space-y-6">
                {replies.length > 0 ? (
                  replies.map((reply) => (
                    <div key={reply.id} className={`${reply.is_incoming ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'} border rounded-xl p-6 relative`}>
                      <div className="flex justify-between items-center mb-4">
                        <span className={`text-xs font-bold uppercase tracking-widest ${reply.is_incoming ? 'text-blue-600' : 'text-green-600'}`}>
                          {reply.is_incoming ? 'Incoming Reply' : 'AI Auto-Reply'}
                        </span>
                        <span className={`text-xs ${reply.is_incoming ? 'text-blue-400' : 'text-green-400'}`}>
                          {new Date(reply.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                        {reply.message}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 italic border-2 border-dashed border-gray-200">
                    No replies detected yet for this outreach.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Mail className="w-16 h-16 mb-4 text-gray-200" />
            <p>Select an email from the list to view details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
