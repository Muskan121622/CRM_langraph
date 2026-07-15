import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFollowUps } from '../store/interactionSlice';
import { CheckCircle2, Clock, Calendar as CalendarIcon, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FollowUps() {
  const dispatch = useDispatch();
  const { followups } = useSelector(state => state.interaction);

  useEffect(() => {
    dispatch(fetchFollowUps());
  }, [dispatch]);

  const pendingFollowups = followups.filter(f => f.status === 'Pending');
  const completedFollowups = followups.filter(f => f.status === 'Completed');

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden bg-gray-50">
      <div className="mb-8 shrink-0">
        <h1 className="text-3xl font-bold text-gray-900">Follow-up Tasks</h1>
        <p className="text-gray-500 mt-2">Manage your AI-generated action items and schedules.</p>
      </div>

      <div className="flex gap-8 flex-1 min-h-0">
        
        {/* Pending Column */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-amber-50/30 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" /> Pending Tasks
            </h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{pendingFollowups.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {pendingFollowups.map(task => (
                <motion.div key={task.id} variants={item} className="p-4 border border-amber-100 bg-amber-50/10 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group">
                  <h3 className="font-semibold text-gray-900 mb-2">{task.action}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Due: {new Date(task.date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> Interaction #{task.interaction_id}</span>
                  </div>
                  <button className="w-full py-2 bg-white border border-amber-200 text-amber-700 font-medium text-xs rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <CheckCircle2 className="w-4 h-4" /> Mark Complete
                  </button>
                </motion.div>
              ))}
              {pendingFollowups.length === 0 && (
                <div className="text-center py-12 text-gray-400">No pending tasks. You're all caught up!</div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Completed Column */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden opacity-75">
          <div className="p-4 border-b border-gray-100 bg-emerald-50/30 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Completed
            </h2>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">{completedFollowups.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {completedFollowups.map(task => (
                <motion.div key={task.id} variants={item} className="p-4 border border-gray-200 bg-gray-50 rounded-xl shadow-sm">
                  <h3 className="font-medium text-gray-500 line-through mb-2">{task.action}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {new Date(task.date).toLocaleDateString()}</span>
                  </div>
                </motion.div>
              ))}
              {completedFollowups.length === 0 && (
                <div className="text-center py-12 text-gray-400">No completed tasks yet.</div>
              )}
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
