import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHistory } from '../store/interactionSlice';
import { Download, Search, Clock, MapPin, Package, HeartPulse, FileText } from 'lucide-react';
import { generateManagerReport } from '../utils/pdfExport';
import { motion } from 'framer-motion';

export default function HCPHistory() {
  const dispatch = useDispatch();
  const { history } = useSelector(state => state.interaction);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    dispatch(fetchHistory());
  }, [dispatch]);

  const filteredHistory = history.filter(interaction => 
    interaction.doctor?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    interaction.hospital?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    interaction.products?.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportPDF = () => {
    generateManagerReport(filteredHistory);
  };

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interaction History</h1>
          <p className="text-gray-500 mt-2">View and manage all past HCP visits.</p>
        </div>
        
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
        >
          <Download size={18} />
          Export PDF Report
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <div className="relative w-80">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by doctor, hospital, or product..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500 font-medium">
            {filteredHistory.length} interactions found
          </div>
        </div>

        <div className="overflow-auto flex-1 p-4">
          <div className="space-y-4">
            {filteredHistory.map((interaction, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={interaction.id} 
                className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors bg-white shadow-sm hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {interaction.doctor?.name || 'Unknown'}
                      <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {interaction.doctor?.specialty || 'General'}
                      </span>
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><MapPin w="14" h="14" /> {interaction.doctor?.hospital || 'Not specified'}</span>
                      <span className="flex items-center gap-1"><Clock w="14" h="14" /> {new Date(interaction.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border
                      ${interaction.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        interaction.sentiment === 'Negative' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                        'bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                      {interaction.sentiment === 'Positive' ? '😊' : interaction.sentiment === 'Negative' ? '😞' : '😐'}
                      {interaction.sentiment || 'Neutral'}
                    </div>
                    <button 
                      onClick={() => generateManagerReport([interaction])}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-transparent hover:border-blue-200"
                      title="Export specific report"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Package size={14} /> Products Discussed</p>
                    <p className="text-sm font-medium text-gray-800">
                      {interaction.products?.length > 0 ? interaction.products.map(p => p.name).join(', ') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><HeartPulse size={14} /> Topics</p>
                    <p className="text-sm font-medium text-gray-800 truncate" title={interaction.topics}>{interaction.topics || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><FileText size={14} /> Materials Shared</p>
                    <p className="text-sm font-medium text-gray-800 truncate" title={interaction.materials}>{interaction.materials || '-'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">Samples Given</p>
                      <p className="text-sm font-bold text-gray-900">{interaction.samples_distributed || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">Samples Requested</p>
                      <p className="text-sm font-bold text-blue-700">{interaction.samples_requested || 0}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Executive Summary / Outcomes</p>
                  <p className="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 rounded p-3 italic">
                    "{interaction.notes || 'No summary provided.'}"
                  </p>
                </div>
              </motion.div>
            ))}
            
            {filteredHistory.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>No interactions found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
