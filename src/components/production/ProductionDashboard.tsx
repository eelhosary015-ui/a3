import React from 'react';
import { Activity, Zap, ShieldCheck, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

export function ProductionDashboard() {
  const kpis = [
    { title: 'OEE (الكفاءة الكلية)', value: '85%', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { title: 'Availability (الإتاحة)', value: '92%', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Performance (الأداء)', value: '88%', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-100' },
    { title: 'Quality (الجودة)', value: '98%', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4"
            >
              <div className={`p-4 rounded-xl ${kpi.bg}`}>
                <Icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-1">{kpi.title}</h3>
                <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placeholder for charts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            حجم الإنتاج الشهري
          </h3>
          <div className="h-full flex items-center justify-center text-slate-400">
            [رسم بياني للإنتاج]
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-500" />
            أعطال الماكينات (Downtime)
          </h3>
          <div className="h-full flex items-center justify-center text-slate-400">
            [رسم بياني لأعطال الماكينات]
          </div>
        </div>
      </div>
    </div>
  );
}
