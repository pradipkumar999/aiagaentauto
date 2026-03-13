"use client";

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Search
} from 'lucide-react';

interface HealthData {
  id: number;
  host: string;
  from_email: string;
  from_name: string;
  domain: string;
  dns: {
    spf: string;
    dmarc: string;
  };
  blacklists: {
    name: string;
    isBlacklisted: boolean;
  }[];
  isHealthy: boolean;
}

export default function DomainHealthPage() {
  const [data, setData] = useState<HealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
  }, []);

  async function fetchHealthData() {
    try {
      setLoading(true);
      const res = await fetch('/api/health');
      const healthData = await res.json();
      setData(healthData);
    } catch {
      setError('Failed to fetch domain health data');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchHealthData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Domain Health Dashboard</h2>
          <p className="text-gray-600">Monitor your SMTP domains for blacklists and DNS configuration.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`p-4 ${item.isHealthy ? 'bg-green-50' : 'bg-red-50'} border-b border-gray-200`}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">{item.domain}</h3>
                {item.isHealthy ? (
                  <ShieldCheck className="text-green-600 w-6 h-6" />
                ) : (
                  <ShieldAlert className="text-red-600 w-6 h-6" />
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{item.from_email}</p>
            </div>
            
            <div className="p-4 space-y-4">
              {/* DNS Records */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">DNS Configuration</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">SPF Record</span>
                    {item.dns.spf ? (
                      <CheckCircle className="text-green-500 w-4 h-4" />
                    ) : (
                      <XCircle className="text-red-500 w-4 h-4" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">DMARC Record</span>
                    {item.dns.dmarc ? (
                      <CheckCircle className="text-green-500 w-4 h-4" />
                    ) : (
                      <XCircle className="text-red-500 w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Blacklists */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Blacklist Status</h4>
                <div className="space-y-2">
                  {item.blacklists.map((bl) => (
                    <div key={bl.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 text-xs">{bl.name.split('.')[0].toUpperCase()}</span>
                      {bl.isBlacklisted ? (
                        <div className="flex items-center text-red-600 font-medium">
                          <span className="mr-1">Blacklisted</span>
                          <AlertCircle className="w-3 h-3" />
                        </div>
                      ) : (
                        <span className="text-green-600 font-medium">Clean</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
              <p className="text-xs text-gray-500">Host: {item.host}</p>
            </div>
          </div>
        ))}

        {data.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No SMTP Domains Found</h3>
            <p className="text-gray-500">Please add an SMTP configuration first.</p>
          </div>
        )}
      </div>
    </div>

  );
}
