import db from "@/lib/db";
import { Users, Mail, MousePointer2 } from "lucide-react";

async function getStats() {
  const totalContacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get() as { count: number };
  const emailsSent = db.prepare("SELECT COUNT(*) as count FROM emails WHERE status = 'sent'").get() as { count: number };
  const repliesReceived = db.prepare("SELECT COUNT(*) as count FROM replies").get() as { count: number };
  
  const tracking = db.prepare("SELECT SUM(opened) as opens, SUM(clicked) as clicks FROM emails").get() as { opens: number, clicks: number };

  const conversion = emailsSent.count > 0 
    ? ((repliesReceived.count / emailsSent.count) * 100).toFixed(1) 
    : 0;

  return {
    totalLeads: totalContacts.count,
    emailsSent: emailsSent.count,
    replies: repliesReceived.count,
    opens: tracking.opens || 0,
    clicks: tracking.clicks || 0,
    conversion
  };
}

export default async function Dashboard() {
  const stats = await getStats();

  const cards = [
    { name: "Total Leads", value: stats.totalLeads, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { name: "Emails Sent", value: stats.emailsSent, icon: Mail, color: "text-green-600", bg: "bg-green-100" },
    { name: "Opens", value: stats.opens, icon: Mail, color: "text-orange-600", bg: "bg-orange-100" },
    { name: "Clicks", value: stats.clicks, icon: MousePointer2, color: "text-red-600", bg: "bg-red-100" },
  ];

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-gray-600">Overview of your affiliate outreach performance.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bg}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-500 font-medium">{card.name}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h3>
          <div className="text-gray-500 text-sm text-center py-12">
            No recent activity to show.
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Active Campaigns</h3>
          <div className="text-gray-500 text-sm text-center py-12">
            No active campaigns.
          </div>
        </div>
      </div>
    </div>
  );
}
