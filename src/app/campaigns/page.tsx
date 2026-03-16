"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Play, 
  Loader2, 
  Square, 
  History, 
  Trash2, 
  PlusCircle, 
  Zap, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Terminal,
  X
} from 'lucide-react';

interface CampaignRecord {
  id: number;
  name: string;
  product_name: string;
  status: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
}

interface CampaignLog {
  id: number;
  msg: string;
  type: string;
  created_at: string;
}

export default function CampaignsPage() {
  const [products, setProducts] = useState<{id: number, name: string}[]>([]);
  const [pastCampaigns, setPastCampaigns] = useState<CampaignRecord[]>([]);
  const [campaign, setCampaign] = useState({
    name: '',
    product_id: '',
    tone: 'friendly'
  });
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Console drawer state
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleCampaign, setConsoleCampaign] = useState<CampaignRecord | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<CampaignLog[]>([]);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const consolePollingRef = useRef<NodeJS.Timeout | null>(null);
  const consoleBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Scroll to bottom when new console logs arrive
  useEffect(() => {
    if (consoleOpen) {
      consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, consoleOpen]);

  async function fetchData() {
    try {
      const prodRes = await fetch('/api/products', { cache: 'no-store' });
      const prodData = await prodRes.json();
      if (Array.isArray(prodData)) setProducts(prodData);

      const campRes = await fetch('/api/campaigns/run', { cache: 'no-store' });
      const campData = await campRes.json();
      if (Array.isArray(campData)) setPastCampaigns(campData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }

  async function startPolling(campaignId: number) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/logs?id=${campaignId}`, { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data)) setLogs(data);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
  }

  async function openConsole(c: CampaignRecord) {
    setConsoleCampaign(c);
    setConsoleLogs([]);
    setConsoleLoading(true);
    setConsoleOpen(true);

    // Initial fetch
    try {
      const res = await fetch(`/api/campaigns/logs?id=${c.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setConsoleLogs(data);
    } catch (err) {
      console.error('Console fetch error:', err);
    }
    setConsoleLoading(false);

    // Start polling
    if (consolePollingRef.current) clearInterval(consolePollingRef.current);
    consolePollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/logs?id=${c.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data)) setConsoleLogs(data);
      } catch (err) {
        console.error('Console polling error:', err);
      }
    }, 2000);
  }

  function closeConsole() {
    setConsoleOpen(false);
    if (consolePollingRef.current) clearInterval(consolePollingRef.current);
    setConsoleCampaign(null);
    setConsoleLogs([]);
  }

  async function stopCampaign() {
    try {
      await fetch('/api/campaigns/stop', { method: 'POST' });
    } catch {
      alert("Failed to send stop request");
    }
  }

  async function runCampaign() {
    if (!campaign.product_id) {
      alert("Please select a product");
      return;
    }
    setIsRunning(true);
    setLogs([]);
    try {
      const res = await fetch('/api/campaigns/run', {
        method: 'POST',
        body: JSON.stringify(campaign),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.campaignId) {
        startPolling(data.campaignId);
      }
      setTimeout(async () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        fetchData();
        setIsRunning(false);
      }, 2000);
    } catch (err) {
      console.error('Run campaign error:', err);
      setIsRunning(false);
    }
  }

  async function deleteCampaign(id: number) {
    if (!confirm('Are you sure you want to delete this campaign? This will also delete all associated logs.')) return;
    try {
      const res = await fetch(`/api/campaigns/run?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (consoleCampaign?.id === id) closeConsole();
        fetchData();
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Delete campaign error:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</span>;
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Running</span>;
      case 'stopped':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><XCircle className="w-3 h-3 mr-1" /> Stopped</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Failed</span>;
    }
  };

  const getLogColor = (type: string) => {
    if (type === 'error') return 'text-red-400';
    if (type === 'success') return 'text-emerald-400 font-semibold';
    return 'text-gray-300';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Campaign Center</h2>
          <p className="text-gray-500 mt-1 text-lg">Launch and scale your AI-driven outreach strategy.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center">
            <Zap className="w-4 h-4 text-amber-500 mr-2" />
            <span className="text-sm font-semibold text-gray-700">{pastCampaigns.length} Campaigns</span>
          </div>
          <button 
            onClick={fetchData}
            className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* TOP ROW: Controls & Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full">
            <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-xl font-bold flex items-center">
                <PlusCircle className="w-6 h-6 mr-2" /> Start Outreach
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Campaign Name</label>
                <input 
                  type="text" 
                  className="block w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500 transition-all outline-none border hover:border-gray-400"
                  placeholder="e.g. Summer Book Launch"
                  value={campaign.name}
                  onChange={e => setCampaign({ ...campaign, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Product</label>
                <select 
                  className="block w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500 transition-all outline-none border hover:border-gray-400"
                  value={campaign.product_id}
                  onChange={e => setCampaign({ ...campaign, product_id: e.target.value })}
                >
                  <option value="">Select a product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Voice & Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {['friendly', 'professional', 'urgent'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setCampaign({ ...campaign, tone: t })}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all capitalize ${
                        campaign.tone === t 
                          ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm' 
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="pt-2">
                {!isRunning ? (
                  <button 
                    onClick={runCampaign}
                    className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" /> Initialize Campaign
                  </button>
                ) : (
                  <button 
                    onClick={stopCampaign}
                    className="w-full flex items-center justify-center px-6 py-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
                  >
                    <Square className="w-5 h-5 mr-2 fill-current" /> Terminate Run
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Column */}
        <div className="lg:col-span-7">
          <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden flex flex-col h-full min-h-[400px]">
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Execution Console</span>
              {isRunning && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2 custom-scrollbar max-h-[400px]">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic py-20">
                  <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                  <span>Awaiting execution signal...</span>
                </div>
              )}
              {[...logs].reverse().map((log) => (
                <div key={log.id} className="flex space-x-3 group animate-in fade-in duration-300">
                  <span className="text-gray-600 shrink-0 select-none">[{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}]</span>
                  <span className={`${getLogColor(log.type)} break-words`}>
                    <span className="text-gray-500 mr-1">$</span>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Full Width Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <History className="w-6 h-6 mr-2 text-indigo-600" /> Campaign Records
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-[11px] font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4">Campaign & Product</th>
                <th className="px-6 py-4 text-center">Reach</th>
                <th className="px-6 py-4 text-center">Engagement</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Console</th>
                <th className="px-6 py-4 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pastCampaigns.map((c) => (
                <tr key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-bold text-gray-900 text-sm">{c.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{c.product_name}</div>
                  </td>
                  <td className="px-6 py-5 text-center text-sm font-bold text-blue-600">
                    {c.sent_count}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center space-x-4">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Opens</span>
                        <span className="text-sm font-bold text-orange-600">{c.opened_count || 0}</span>
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Clicks</span>
                        <span className="text-sm font-bold text-rose-600">{c.clicked_count || 0}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {getStatusBadge(c.status)}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button
                      onClick={() => openConsole(c)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        consoleCampaign?.id === c.id && consoleOpen
                          ? 'bg-gray-900 text-emerald-400 border-gray-700'
                          : 'bg-gray-900 text-gray-300 border-gray-700 hover:text-emerald-400 hover:border-emerald-700'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Live Console
                    </button>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => deleteCampaign(c.id)}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {pastCampaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-32 text-center text-gray-400">
                    <div className="flex flex-col items-center">
                      <Mail className="w-12 h-12 mb-4 opacity-10" />
                      <span className="italic text-lg">No active or past campaigns found.</span>
                      <span className="text-sm mt-1 opacity-60">Ready to launch your first sequence?</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Console Drawer/Modal */}
      {consoleOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeConsole}
          />
          {/* Panel */}
          <div className="relative z-10 w-full sm:max-w-2xl mx-4 mb-0 sm:mb-0 bg-gray-950 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-800 overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            {/* Console Header */}
            <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Live Execution Console</span>
                  {consoleCampaign && (
                    <span className="text-[11px] text-emerald-400 font-mono">{consoleCampaign.name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  LIVE
                </div>
                <button
                  onClick={closeConsole}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Log Output */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1.5 min-h-[300px]">
              {consoleLoading && (
                <div className="flex items-center gap-2 text-gray-500 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching logs...</span>
                </div>
              )}
              {!consoleLoading && consoleLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-gray-600 italic">
                  <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
                  <span>No logs yet for this campaign.</span>
                </div>
              )}
              {consoleLogs.map((log) => (
                <div key={log.id} className="flex gap-3 animate-in fade-in duration-200">
                  <span className="text-gray-600 shrink-0 select-none">
                    [{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}]
                  </span>
                  <span className={`${getLogColor(log.type)} break-words`}>
                    <span className="text-gray-600 mr-1">›</span>
                    {log.msg}
                  </span>
                </div>
              ))}
              <div ref={consoleBottomRef} />
            </div>

            {/* Console Footer */}
            <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] text-gray-600 font-mono">
                {consoleLogs.length} log entries · auto-refresh every 2s
              </span>
              {consoleCampaign && (
                <span className={`text-[10px] font-bold uppercase ${
                  consoleCampaign.status === 'active' ? 'text-blue-400' :
                  consoleCampaign.status === 'completed' ? 'text-emerald-400' : 'text-gray-500'
                }`}>
                  {consoleCampaign.status}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
