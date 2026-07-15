import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboardStats, fetchHistory } from '../store/interactionSlice';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, Package, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = ['#10b981', '#f59e0b', '#ef4444']; // Positive, Neutral, Negative

export default function Analytics() {
  const dispatch = useDispatch();
  const { stats, history } = useSelector(state => state.interaction);

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchHistory());
  }, [dispatch]);

  // Compute real data from history
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Aggregate visits by month
  const monthlyMap = {};
  history.forEach(h => {
    const d = new Date(h.date);
    const m = monthNames[d.getMonth()];
    monthlyMap[m] = (monthlyMap[m] || 0) + 1;
  });

  // Ensure last 6 months have at least 0
  const currentMonthIdx = new Date().getMonth();
  const monthlyInteractions = [];
  for (let i = 5; i >= 0; i--) {
    let idx = currentMonthIdx - i;
    if (idx < 0) idx += 12;
    const m = monthNames[idx];
    monthlyInteractions.push({ name: m, visits: monthlyMap[m] || 0 });
  }

  // Sentiment Breakdown
  const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
  history.forEach(h => {
    if (h.sentiment === 'Positive') sentimentCounts.Positive++;
    else if (h.sentiment === 'Negative') sentimentCounts.Negative++;
    else sentimentCounts.Neutral++;
  });
  
  const sentimentData = [
    { name: 'Positive', value: sentimentCounts.Positive },
    { name: 'Neutral', value: sentimentCounts.Neutral },
    { name: 'Negative', value: sentimentCounts.Negative },
  ].filter(d => d.value > 0); // Hide empty slices

  const positivePercentage = stats?.total_interactions > 0 
    ? (stats.positive_sentiment_ratio * 100).toFixed(0) 
    : 0;

  return (
    <div className="p-8 h-screen overflow-y-auto bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Overview</h1>
        <p className="text-gray-500 mt-2">Deep dive into your territory's performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Activity className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Visits</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats?.total_interactions || 0}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
            <TrendingUp className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Positive Response</p>
            <h3 className="text-2xl font-bold text-gray-900">{positivePercentage}%</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <Package className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Samples Given</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats?.total_samples || 0}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <Users className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Doctors Met</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats?.total_interactions || 0}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Monthly Interactions Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Interaction Volume (YTD)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyInteractions} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Sentiment Analysis</h3>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
