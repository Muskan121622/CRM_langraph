import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logInteractionAgent, addChatMessage, fetchDashboardStats } from '../store/interactionSlice';
import { Send, Bot, User, Mic, Search, Plus, Calendar, Clock, AlertTriangle, Sparkles, Lightbulb, FileText, Smile } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LogInteraction() {
  const dispatch = useDispatch();
  const { chatThread, chatStatus, extractedData } = useSelector((state) => state.interaction);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);

  // Form State aligned with mockup and AI extractions
  const [formData, setFormData] = useState({
    doctorName: '',
    hospital: '',
    specialty: '',
    interactionType: 'Meeting',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    attendees: '',
    topics: '',
    materials: '',
    samplesDistributed: 0,
    samplesRequested: 0,
    sentiment: 'Neutral',
    outcomes: '',
    followupActions: '',
  });

  // Dynamic Suggestions from AI
  const aiSuggestions = extractedData?.suggested_followups?.length > 0 
    ? extractedData.suggested_followups 
    : [
        "Schedule a follow-up meeting",
        "Send clinical study literature",
        "Invite to next medical seminar"
      ];

  const aiMaterials = extractedData?.suggested_materials?.length > 0
    ? extractedData.suggested_materials
    : [
        "CardioPlus Dosage Guide",
        "Phase III Clinical Trial Summary",
        "Patient Education Leaflet"
      ];

  // Auto-fill logic when AI extracts data
  useEffect(() => {
    if (extractedData && Object.keys(extractedData).length > 0) {
      const intents = extractedData.intents || [];
      const isEdit = intents.includes('edit');
      const isDoctorEdit = isEdit && extractedData.entity_type === 'doctor';

      if (isDoctorEdit) {
        // After a doctor edit: fetch interactions + followups and populate all form fields
        const targetName = extractedData.new_doctor_name || extractedData.doctor_name;
        const oldName = extractedData.old_doctor_name;

        Promise.all([
          fetch('http://localhost:8000/interactions/').then(r => r.json()),
          fetch('http://localhost:8000/followups/').then(r => r.json()),
        ])
          .then(([interactions, followups]) => {
            const match = interactions.find(i =>
              i.doctor?.name === targetName || i.doctor?.name === oldName
            );
            if (match) {
              // Find follow-up linked to this interaction
              const followup = followups.find(f => f.interaction_id === match.id);
              setFormData({
                doctorName: targetName || match.doctor?.name || '',
                hospital: match.doctor?.hospital || '',
                specialty: match.doctor?.specialty || '',
                interactionType: match.interaction_type || 'Meeting',
                topics: match.topics || '',
                materials: match.materials || '',
                samplesDistributed: match.samples_distributed ?? 0,
                samplesRequested: match.samples_requested ?? 0,
                sentiment: match.sentiment || 'Neutral',
                outcomes: match.notes || '',
                followupActions: followup?.action || '',
              });
            } else {
              // Doctor has no interactions yet — just show name
              setFormData(prev => ({ ...prev, doctorName: targetName }));
            }
          })
          .catch(() => {
            setFormData(prev => ({ ...prev, doctorName: extractedData.new_doctor_name || prev.doctorName }));
          });

      } else if (isEdit) {
        // Interaction-level edit: merge only changed fields, keep everything else intact
        setFormData(prev => ({
          ...prev,
          doctorName: extractedData.new_doctor_name || extractedData.doctor_name || prev.doctorName,
          hospital: extractedData.hospital || prev.hospital,
          specialty: extractedData.specialty || prev.specialty,
          interactionType: extractedData.interaction_type || prev.interactionType,
          topics: extractedData.topics || prev.topics,
          materials: (Array.isArray(extractedData.materials_shared) && extractedData.materials_shared.length > 0) ? extractedData.materials_shared.join(', ') : prev.materials,
          samplesDistributed: (extractedData.samples_distributed !== undefined && extractedData.samples_distributed !== -1) ? extractedData.samples_distributed : prev.samplesDistributed,
          samplesRequested: (extractedData.samples_requested !== undefined && extractedData.samples_requested !== -1) ? extractedData.samples_requested : prev.samplesRequested,
          sentiment: extractedData.sentiment || prev.sentiment,
          outcomes: extractedData.notes || prev.outcomes,
          followupActions: extractedData.action || prev.followupActions,
        }));

      } else {
        // New log / search / delete: completely overwrite to avoid old data bleeding
        setFormData({
          doctorName: extractedData.doctor_name || '',
          hospital: extractedData.hospital || '',
          specialty: extractedData.specialty || '',
          interactionType: extractedData.interaction_type || 'Meeting',
          topics: extractedData.topics || '',
          materials: (Array.isArray(extractedData.materials_shared) && extractedData.materials_shared.length > 0) ? extractedData.materials_shared.join(', ') : '',
          samplesDistributed: extractedData.samples_distributed !== undefined && extractedData.samples_distributed !== -1 ? extractedData.samples_distributed : 0,
          samplesRequested: extractedData.samples_requested !== undefined && extractedData.samples_requested !== -1 ? extractedData.samples_requested : 0,
          sentiment: extractedData.sentiment || 'Neutral',
          outcomes: extractedData.notes || '',
          followupActions: extractedData.action || '',
        });
      }

      dispatch(fetchDashboardStats());
    }
  }, [extractedData, dispatch]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    dispatch(addChatMessage({ sender: 'user', text: input }));
    dispatch(logInteractionAgent(input));
    setInput('');
  };

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
      return;
    }
    
    if (isListening) return; // Prevent multiple instances
    
    setIsListening(true);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? " " : "") + transcript);
      setIsListening(false);
    };
    
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatThread]);

  const handleManualSave = () => {
    alert("Interaction Saved to Database!");
  };

  return (
    <div className="h-screen flex p-4 gap-4 bg-gray-50 text-gray-800">
      
      {/* Left Side: Advanced Form */}
      <div className="w-[60%] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        
        <div className="p-5 border-b bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">Log HCP Interaction</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">HCP Profile</h3>
          
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            
            {/* Top Row: HCP, Hospital, Specialty */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">HCP Name</label>
                <div className="relative">
                  <input type="text" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" placeholder="Search or select HCP..." value={formData.doctorName} onChange={e => setFormData({...formData, doctorName: e.target.value})}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hospital/Clinic</label>
                <input type="text" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" placeholder="e.g. Apollo Hospital" value={formData.hospital} onChange={e => setFormData({...formData, hospital: e.target.value})}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Specialty</label>
                <input type="text" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" placeholder="e.g. Endocrinologist" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})}/>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b mt-6">Interaction Details</h3>

            {/* Date, Time, Type Row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Interaction Type</label>
                <select className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" value={formData.interactionType} onChange={e => setFormData({...formData, interactionType: e.target.value})}>
                  <option>Meeting</option>
                  <option>Phone Call</option>
                  <option>Email</option>
                  <option>Virtual Meeting</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <div className="relative">
                  <input type="date" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/>
                  <Calendar className="absolute right-2 top-2.5 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                <div className="relative">
                  <input type="time" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}/>
                  <Clock className="absolute right-2 top-2.5 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Attendees</label>
              <input type="text" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" placeholder="Enter names or search..." value={formData.attendees} onChange={e => setFormData({...formData, attendees: e.target.value})}/>
            </div>

            {/* Topics Discussed */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Topics Discussed</label>
              <textarea rows="3" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border" placeholder="Enter key discussion points..." value={formData.topics} onChange={e => setFormData({...formData, topics: e.target.value})}></textarea>
              <button 
                type="button"
                onClick={toggleVoiceInput}
                className={`text-xs font-medium flex items-center gap-1 mt-1 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-blue-600 hover:text-blue-700'}`}
              >
                <Mic className="w-3 h-3" /> {isListening ? 'Listening...' : 'Summarize from Voice Note (Requires Consent)'}
              </button>
            </div>

            {/* Materials & Samples Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Materials Shared / Samples Distributed</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between border rounded-md p-3 bg-gray-50">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Materials Shared</label>
                    {formData.materials ? (
                      <span className="text-sm text-gray-800">{formData.materials}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No materials added</span>
                    )}
                  </div>
                  <button className="border bg-white text-xs px-3 py-1.5 rounded shadow-sm flex items-center gap-1 text-gray-600 hover:bg-gray-50">
                    <Search className="w-3 h-3" /> Search/Add
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-md p-3 bg-gray-50">
                    <label className="block text-xs font-medium text-gray-600 mb-2">Samples Distributed</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0"
                        className="w-20 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-1.5 border text-center"
                        value={formData.samplesDistributed}
                        onChange={e => setFormData({...formData, samplesDistributed: parseInt(e.target.value) || 0})}
                      />
                      <span className="text-xs text-gray-500">units</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-3 bg-gray-50 flex flex-col justify-center">
                    <label className="block text-xs font-medium text-gray-600 mb-2">Sample Requested for Future</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0"
                        className="w-20 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-1.5 border text-center"
                        value={formData.samplesRequested}
                        onChange={e => setFormData({...formData, samplesRequested: parseInt(e.target.value) || 0})}
                      />
                      <span className="text-xs text-gray-500">units</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Outcomes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">AI Executive Summary (Outcomes)</label>
              <textarea rows="3" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-gray-50/50" placeholder="Key outcomes or agreements..." value={formData.outcomes} onChange={e => setFormData({...formData, outcomes: e.target.value})}></textarea>
            </div>

            {/* Follow-up Plans */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Plans</label>
              <textarea rows="2" className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-gray-50/50" placeholder="Planned follow-up actions..." value={formData.followupActions} onChange={e => setFormData({...formData, followupActions: e.target.value})}></textarea>
            </div>
            {/* AI Toolkit Section */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">AI Bonus Toolkit</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Powered by LangGraph Agent</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Sentiment Tool */}
                <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <Smile className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-indigo-900">Sentiment Analysis</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Positive', 'Neutral', 'Negative'].map(opt => (
                      <label key={opt} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${formData.sentiment === opt ? (opt === 'Positive' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : opt === 'Negative' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-blue-50 border-blue-200 text-blue-700') : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <input 
                          type="radio" 
                          name="sentiment" 
                          className="sr-only"
                          checked={formData.sentiment === opt}
                          onChange={() => setFormData({...formData, sentiment: opt})}
                        />
                        <span>{opt === 'Positive' ? '😊' : opt === 'Neutral' ? '😐' : '😞'}</span>
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Follow-up Tool */}
                <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors md:row-span-2">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-blue-900">Smart Recommendations</h4>
                  </div>
                  <div className="space-y-2">
                    {aiSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-2 items-start p-2 rounded-lg bg-blue-50/50 border border-blue-100/50 text-xs text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setFormData({...formData, followupActions: suggestion})}>
                        <div className="mt-0.5 min-w-[4px] h-4 w-1 bg-blue-500 rounded-full"></div>
                        <span className="leading-tight">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Material Tool */}
                <div className="bg-white border border-purple-100 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-bold text-purple-900">Material Suggestions</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiMaterials.map((mat, idx) => (
                      <span key={idx} onClick={() => setFormData({...formData, materials: formData.materials ? formData.materials + ', ' + mat : mat})} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-medium cursor-pointer hover:bg-purple-100 transition-colors">
                        <Plus className="w-3 h-3" /> {mat}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </form>
        </div>
      </div>

      {/* Right Side: AI Chat */}
      <div className="w-[40%] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
        <div className="p-3 border-b bg-gray-50/50 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <Bot size={14} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-800">AI Assistant</h3>
            <p className="text-[10px] text-gray-500">Log interaction via chat</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-gray-50/30">
          {chatThread.length === 0 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-white text-gray-600 text-xs shadow-sm">
              Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.
            </div>
          )}
          
          {chatThread.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                {msg.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div className={`px-3 py-2 rounded-lg max-w-[85%] shadow-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none'}`}>
                <div className="whitespace-pre-wrap leading-relaxed text-xs">{msg.text}</div>
              </div>
            </motion.div>
          ))}
          {chatStatus === 'loading' && (
            <div className="flex gap-3">
               <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Bot size={12} />
               </div>
               <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 flex items-center gap-1 rounded-tl-none shadow-sm h-8">
                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                 <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
               </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 bg-white border-t flex gap-2 items-center">
          <input 
            type="text" 
            className="flex-1 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-xs p-2 border"
            placeholder="Describe interaction..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-blue-600'}`}
          >
            <Mic size={14} />
          </button>
          <button 
            onClick={handleManualSave}
            className="px-4 py-2 bg-gray-500 text-white text-xs font-semibold rounded-md flex items-center gap-1 hover:bg-gray-600 transition-colors whitespace-nowrap"
          >
            <AlertTriangle size={12} /> Log
          </button>
        </div>
      </div>
      
    </div>
  );
}
