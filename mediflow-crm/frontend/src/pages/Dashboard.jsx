import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboardStats } from '../store/interactionSlice';
import { Users, Clock, ThumbsUp, ThumbsDown, Package, Activity, MessageSquare, Briefcase, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const dispatch = useDispatch();
  const { stats } = useSelector((state) => state.interaction);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  const cards = [
    { title: "Today's Visits", value: stats?.today_visits || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Pending Follow-ups", value: stats?.pending_followups || 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { title: "Positive Doctors", value: stats?.positive_doctors || 0, icon: ThumbsUp, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Negative Feedback", value: stats?.negative_feedback || 0, icon: ThumbsDown, color: "text-rose-600", bg: "bg-rose-100" },
    { title: "Samples Distributed", value: stats?.samples_distributed || 0, icon: Package, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: "Top Product", value: stats?.top_product || "-", icon: Activity, color: "text-cyan-600", bg: "bg-cyan-100" },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // Dummy timeline data for demonstration. In reality, this would be fetched from a `/timeline` endpoint.
  const timelineEvents = [
    { id: 1, time: "10:30 AM", type: "meeting", title: "Meeting with Dr. Sharma", desc: "Discussed Diabetes Plus efficacy.", icon: Users, color: "bg-blue-500" },
    { id: 2, time: "10:45 AM", type: "material", title: "Brochure Shared", desc: "Sent 'Diabetes Plus Clinical Trial' PDF.", icon: FileText, color: "bg-purple-500" },
    { id: 3, time: "10:50 AM", type: "sample", title: "Samples Requested", desc: "Doctor requested 10 samples of Diabetes Plus.", icon: Package, color: "bg-emerald-500" },
    { id: 4, time: "11:00 AM", type: "followup", title: "Follow-up Scheduled", desc: "AI suggested meeting in 2 weeks. Task added.", icon: Clock, color: "bg-amber-500" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">Welcome back. Here is what is happening today.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {cards.map((card) => (
          <motion.div key={card.title} variants={item} className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Charts (Placeholder) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 flex flex-col items-center justify-center text-gray-400">
            <Activity className="w-12 h-12 mb-4 text-gray-300" />
            <p>Product Interest Chart</p>
            <p className="text-xs mt-2">Powered by Analytics Module</p>
          </div>
        </div>

        {/* Right Side: Activity Timeline */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> Activity Timeline
          </h3>
          
          <div className="relative border-l-2 border-gray-100 ml-3 space-y-8">
            {timelineEvents.map((event, index) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-6"
              >
                {/* Timeline Dot */}
                <span className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white ${event.color} flex items-center justify-center shadow-sm`}>
                </span>
                
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-400 mb-1">{event.time}</span>
                  <h4 className="text-sm font-semibold text-gray-800">{event.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">{event.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
