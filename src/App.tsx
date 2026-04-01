import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Activity, 
  Settings as SettingsIcon, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Trash2,
  Check,
  Search,
  History,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,
  PointElement,
  LineElement
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { callApi } from './services/api';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,
  PointElement,
  LineElement
);

// --- Types ---
export interface Sow {
  sow_id: string;
  breed: string;
  status: 'ว่าง' | 'ผสมแล้ว' | 'ท้อง' | 'เลี้ยงลูก' | 'หย่านม';
  current_parity: number;
}

export interface TaskAction {
  label: string;
  next_status?: string;
  type?: 'success' | 'danger' | 'info' | 'warning';
  isFarrowing?: boolean;
  isAbortion?: boolean;
}

export interface Task {
  id: string;
  sow_id: string;
  type: string;
  due_date: string;
  description: string;
  days_passed?: number;
  actions?: TaskAction[];
}

// --- Components ---

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === '-') return '-';
  // If already dd-MM-yyyy, return
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  // If yyyy-MM-dd, convert to dd-MM-yyyy
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return format(date, 'dd-MM-yyyy');
    }
    // Fallback manual split if Date fails
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "ยืนยัน", cancelText = "ยกเลิก", type = "danger" }: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-2xl mb-4 ${type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <CheckCircle2 size={32} />}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose}
              className="flex-1 p-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 p-4 text-white font-bold rounded-2xl active:scale-95 transition-all ${type === 'danger' ? 'bg-red-600' : 'bg-blue-600'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

const Dashboard = ({ onViewHistory }: { onViewHistory: (sowId: string) => void }) => {
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [confirmTask, setConfirmTask] = useState<{task: Task, action: TaskAction} | null>(null);
  const [cullingAlert, setCullingAlert] = useState<{sow_id: string, failCount: number, reason: string} | null>(null);
  const [farrowingData, setFarrowingData] = useState<{task: Task, action: TaskAction} | null>(null);
  const [healthAlert, setHealthAlert] = useState<{sow_id: string, message: string} | null>(null);
  const [farrowingForm, setFarrowingForm] = useState({
    live_born: 0,
    stillborn: 0,
    mummy: 0,
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    const dashboardRes = await callApi<any>("getDashboard");
    const tasksRes = await callApi<Task[]>("getTasks");
    if (dashboardRes.status === "success" && dashboardRes.data) setStats(dashboardRes.data);
    if (tasksRes.status === "success" && tasksRes.data) setTasks(tasksRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCompleteTask = async (task: Task, action: TaskAction, extraData: any = {}) => {
    const res = await callApi("completeTask", { 
      task_id: task.id, 
      sow_id: task.sow_id,
      next_status: action.next_status,
      completion_date: extraData.date || format(new Date(), 'dd-MM-yyyy'),
      ...extraData
    });
    
    if (res.status === "success") {
      // 1. Culling Logic: Repeated failures
      if (action.next_status === 'ว่าง' && (task.days_passed === 21 || task.days_passed === 30)) {
        // Mock: Assume this is the 3rd failure for demo
        setCullingAlert({ 
          sow_id: task.sow_id, 
          failCount: 3, 
          reason: "แม่พันธุ์ตัวนี้ผสมติดยาก (กลับสัดซ้ำซ้อน) ควรพิจารณาคัดออก" 
        });
      }

      // 2. Abortion Logic
      if (action.isAbortion) {
        setHealthAlert({
          sow_id: task.sow_id,
          message: "บันทึกการแท้งเรียบร้อยแล้ว กรุณาตรวจสอบสุขภาพแม่หมูและพิจารณาการพักฟื้นก่อนผสมใหม่"
        });
      }

      // 3. Litter Performance Logic
      if (action.isFarrowing) {
        const total = (extraData.live_born || 0) + (extraData.stillborn || 0) + (extraData.mummy || 0);
        if (extraData.live_born === 0 || total < 5) {
          setHealthAlert({
            sow_id: task.sow_id,
            message: `⚠️ คำเตือน: ผลผลิตต่ำผิดปกติ (ลูกเกิดมีชีวิต: ${extraData.live_born}, รวม: ${total}) กรุณาตรวจสอบสุขภาพแม่หมูเป็นพิเศษ`
          });
        }
      }

      fetchData();
    }
  };

  if (!stats) return <div className="p-8 text-center">กำลังโหลด...</div>;

  const doughnutData = {
    labels: ['ว่าง', 'ผสมแล้ว', 'ท้อง', 'เลี้ยงลูก'],
    datasets: [{
      data: [
        stats.statusCount["ว่าง"] || 0,
        stats.statusCount["ผสมแล้ว"] || 0,
        stats.statusCount["ท้อง"] || 0,
        stats.statusCount["เลี้ยงลูก"] || 0
      ],
      backgroundColor: ['#94a3b8', '#38bdf8', '#4ade80', '#fbbf24'],
      borderWidth: 0,
    }]
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center px-4 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
        <div className="bg-blue-100 p-2 rounded-full">
          <Activity size={20} className="text-blue-600" />
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 px-4">
        <StatCard title="แม่หมูทั้งหมด" value={stats.total} icon={Users} color="bg-blue-500" />
        <StatCard title="รอคลอด" value={stats.statusCount["ท้อง"] || 0} icon={Calendar} color="bg-green-500" />
      </div>

      {/* Tasks Due Today */}
      <section className="px-4">
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-orange-600" />
            <h2 className="font-bold text-orange-900">รายการแจ้งเตือนและการจัดการสถานะ ({tasks.length})</h2>
          </div>
          <div className="space-y-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">{task.sow_id} - {task.type}</p>
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  </div>
                  {task.days_passed && (
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full">
                      {task.days_passed} วัน
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {task.actions?.map((action, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        if (action.isFarrowing) {
                          setFarrowingData({ task, action });
                        } else {
                          setConfirmTask({ task, action });
                        }
                      }}
                      className={`flex-1 min-w-[120px] p-3 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        action.type === 'danger' ? 'bg-red-50 text-red-600 border border-red-100' :
                        action.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' :
                        'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}
                    >
                      {action.label}
                    </button>
                  )) || (
                    <button 
                      onClick={() => setConfirmTask({ task, action: { label: 'เสร็จสิ้น' } })}
                      className="w-full p-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      ทำเครื่องหมายว่าเสร็จสิ้น
                    </button>
                  )}
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-center text-gray-400 py-4 text-sm italic">ไม่มีรายการแจ้งเตือนในขณะนี้</p>
            )}
          </div>
        </div>
      </section>

      <ConfirmationModal 
        isOpen={!!confirmTask}
        onClose={() => setConfirmTask(null)}
        onConfirm={() => confirmTask && handleCompleteTask(confirmTask.task, confirmTask.action)}
        title="ยืนยันการดำเนินการ"
        message={`คุณต้องการบันทึก "${confirmTask?.action.label}" สำหรับแม่หมู ${confirmTask?.task.sow_id} ใช่หรือไม่?`}
        confirmText="ยืนยัน"
        type={confirmTask?.action.type === 'danger' ? 'danger' : 'info'}
      />

      {/* Farrowing Modal */}
      <AnimatePresence>
        {farrowingData && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Plus size={32} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">บันทึกการคลอดจริง</h3>
                <p className="text-gray-500 text-sm">แม่หมูเบอร์ {farrowingData.task.sow_id}</p>
              </div>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">วันที่คลอดจริง</label>
                  <input 
                    type="date" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={farrowingForm.date}
                    onChange={e => setFarrowingForm({...farrowingForm, date: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">มีชีวิต</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center"
                      value={farrowingForm.live_born}
                      onChange={e => setFarrowingForm({...farrowingForm, live_born: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">ตายโคม</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center"
                      value={farrowingForm.stillborn}
                      onChange={e => setFarrowingForm({...farrowingForm, stillborn: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">มัมมี่</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center"
                      value={farrowingForm.mummy}
                      onChange={e => setFarrowingForm({...farrowingForm, mummy: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setFarrowingData(null)}
                  className="flex-1 p-4 bg-gray-100 text-gray-600 font-bold rounded-2xl"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => {
                    handleCompleteTask(farrowingData.task, farrowingData.action, { 
                      ...farrowingForm,
                      date: formatDate(farrowingForm.date)
                    });
                    setFarrowingData(null);
                  }}
                  className="flex-1 p-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg"
                >
                  บันทึก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Culling Alert Modal */}
      <ConfirmationModal 
        isOpen={!!cullingAlert}
        onClose={() => setCullingAlert(null)}
        onConfirm={() => {
          if (cullingAlert) onViewHistory(cullingAlert.sow_id);
          setCullingAlert(null);
        }}
        title="⚠️ ข้อแนะนำการคัดออก (Culling)"
        message={cullingAlert?.reason || ""}
        confirmText="ดูประวัติ"
        cancelText="รับทราบ"
        type="danger"
      />

      {/* Health Alert Modal */}
      <ConfirmationModal 
        isOpen={!!healthAlert}
        onClose={() => setHealthAlert(null)}
        onConfirm={() => setHealthAlert(null)}
        title="🏥 การดูแลสุขภาพแม่พันธุ์"
        message={healthAlert?.message || ""}
        confirmText="รับทราบ"
        cancelText="ปิด"
        type="info"
      />

      {/* Charts */}
      <section className="px-4 space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4 text-center">สัดส่วนสถานะแม่พันธุ์</h3>
          <div className="h-48 flex justify-center">
            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">ประสิทธิภาพลูกเกิดมีชีวิต (Live Born)</h3>
          <div className="h-48">
            <Bar 
              data={{
                labels: ['S001', 'S002', 'S003', 'S004', 'S005'],
                datasets: [{
                  label: 'จำนวนลูก',
                  data: [12, 14, 11, 15, 13],
                  backgroundColor: '#3b82f6',
                  borderRadius: 8
                }]
              }} 
              options={{ maintainAspectRatio: false }} 
            />
          </div>
        </div>
      </section>
    </div>
  );
};

const SowMaster = ({ sows, onRefresh, selectedSowId, onSelectSow }: { sows: Sow[], onRefresh: () => void, selectedSowId: string | null, onSelectSow: (id: string | null) => void }) => {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Sow | null>(null);
  const selectedSow = sows.find(s => s.sow_id === selectedSowId) || null;
  const [history, setHistory] = useState<any[]>([]);
  const [newSow, setNewSow] = useState({ sow_id: '', breed: 'Landrace', current_parity: 0 });
  const [error, setError] = useState('');

  const fetchHistory = async (sowId: string) => {
    const res = await callApi<any[]>("getSowHistory", { sow_id: sowId });
    if (res.status === "success" && res.data) setHistory(res.data);
  };

  useEffect(() => {
    if (selectedSowId) {
      fetchHistory(selectedSowId);
    } else {
      setHistory([]);
    }
  }, [selectedSowId]);

  const handleAddSow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Check for duplicate ID
    if (sows.some(s => s.sow_id.toLowerCase() === newSow.sow_id.toLowerCase())) {
      setError(`เบอร์หู ${newSow.sow_id} มีอยู่ในระบบแล้ว`);
      return;
    }

    const res = await callApi("addSow", newSow);
    if (res.status === "success") {
      setShowAdd(false);
      setNewSow({ sow_id: '', breed: 'Landrace', current_parity: 0 });
      onRefresh();
    }
  };

  const handleDeleteSow = async () => {
    if (!confirmDelete) return;
    const res = await callApi("deleteSow", { sow_id: confirmDelete.sow_id });
    if (res.status === "success") {
      onRefresh();
    }
  };

  const filteredSows = sows.filter(sow => 
    sow.sow_id.toLowerCase().includes(search.toLowerCase()) ||
    sow.breed.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center px-4 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">ทะเบียนแม่พันธุ์</h1>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Search Bar */}
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="ค้นหาเบอร์หู หรือสายพันธุ์..."
            className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 space-y-3">
        {filteredSows.map(sow => (
          <div 
            key={sow.sow_id} 
            onClick={() => onSelectSow(sow.sow_id)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-95 transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                {sow.sow_id.slice(-3)}
              </div>
              <div>
                <p className="font-bold text-gray-900">{sow.sow_id}</p>
                <p className="text-xs text-gray-500">{sow.breed} | รุ่น {sow.current_parity}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                sow.status === 'ท้อง' ? 'bg-green-100 text-green-700' :
                sow.status === 'เลี้ยงลูก' ? 'bg-yellow-100 text-yellow-700' :
                sow.status === 'ผสมแล้ว' ? 'bg-blue-100 text-blue-700' :
                sow.status === 'หย่านม' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {sow.status}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(sow); }}
                className="p-2 text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Sow Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">เพิ่มแม่พันธุ์ใหม่</h2>
              <form onSubmit={handleAddSow} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">เบอร์หูแม่หมู</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="เช่น S001"
                    value={newSow.sow_id}
                    onChange={e => setNewSow({...newSow, sow_id: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">สายพันธุ์</label>
                  <select 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newSow.breed}
                    onChange={e => setNewSow({...newSow, breed: e.target.value})}
                  >
                    <option value="Landrace">Landrace</option>
                    <option value="Yorkshire">Yorkshire</option>
                    <option value="Duroc">Duroc</option>
                    <option value="F1">F1 (ลูกผสม)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">ท้องที่ (Parity)</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newSow.current_parity}
                    onChange={e => setNewSow({...newSow, current_parity: parseInt(e.target.value)})}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 p-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 p-4 bg-blue-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Individual Sow Detail Modal */}
      <AnimatePresence>
        {selectedSow && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 font-bold text-xl">
                    {selectedSow.sow_id.slice(-3)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedSow.sow_id}</h2>
                    <p className="text-gray-500">{selectedSow.breed} | รุ่นที่ {selectedSow.current_parity}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onSelectSow(null)}
                  className="p-2 bg-gray-100 rounded-full text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">สถานะปัจจุบัน</p>
                  <p className={`font-bold ${
                    selectedSow.status === 'ท้อง' ? 'text-green-600' :
                    selectedSow.status === 'เลี้ยงลูก' ? 'text-yellow-600' :
                    selectedSow.status === 'ผสมแล้ว' ? 'text-blue-600' :
                    selectedSow.status === 'หย่านม' ? 'text-purple-600' :
                    'text-gray-600'
                  }`}>{selectedSow.status}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">วันที่เข้าฝูง</p>
                  <p className="font-bold text-gray-900">{formatDate((selectedSow as any).entry_date)}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <History size={18} className="text-gray-400" />
                  <h3 className="font-bold text-gray-900">ไทม์ไลน์วงจรการผลิต (Timeline)</h3>
                </div>
                
                <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
                  {history.length > 0 ? history.map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[33px] top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${
                        item.type === 'การผสม' ? 'bg-blue-500' :
                        item.type === 'กำหนดวันคลอด' ? 'bg-green-500' :
                        'bg-gray-400'
                      }`}>
                      </div>
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-gray-900">{item.type}</p>
                          <p className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{formatDate(item.date)}</p>
                        </div>
                        <p className="text-sm text-gray-500">{item.details}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-400 italic">
                      ไม่พบข้อมูลประวัติ
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => onSelectSow(null)}
                className="w-full mt-8 p-4 bg-gray-900 text-white font-bold rounded-2xl active:scale-95 transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteSow}
        title="ยืนยันการลบข้อมูล"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบแม่หมูเบอร์ ${confirmDelete?.sow_id} ออกจากระบบ? ข้อมูลประวัติทั้งหมดจะหายไป`}
        confirmText="ลบข้อมูล"
        type="danger"
      />
    </div>
  );
};

const CycleRecording = ({ sows, onRefresh }: { sows: Sow[], onRefresh: () => void }) => {
  const [step, setStep] = useState(1);
  const [warning, setWarning] = useState<any>(null);
  const [formData, setFormData] = useState({
    sow_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    breeding_type: 'natural', // 'natural' or 'ai'
    boar_id: '',
    semen_id: '',
    technician: '',
    result: 'ท้อง',
    live_born: 0,
    stillborn: 0,
    mummy: 0,
    birth_weight: 0,
    wean_count: 0,
    wean_weight: 0
  });

  // Reset sow_id when step changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, sow_id: '' }));
  }, [step]);

  const handleSubmit = async (e?: React.FormEvent, isConfirmed = false) => {
    if (e) e.preventDefault();
    
    // Validation: Check for status conflicts
    const targetSow = sows.find(s => s.sow_id.toLowerCase() === formData.sow_id.toLowerCase());
    
    if (!isConfirmed && targetSow) {
      let conflictReason = "";
      if (step === 1 && (targetSow.status === 'ผสมแล้ว' || targetSow.status === 'ท้อง')) {
        conflictReason = `แม่หมูเบอร์ ${formData.sow_id} มีสถานะ "${targetSow.status}" อยู่แล้ว การบันทึกการผสมใหม่อาจเป็นการบันทึกซ้ำซ้อน`;
      } else if (step === 2 && targetSow.status !== 'ผสมแล้ว') {
        conflictReason = `แม่หมูเบอร์ ${formData.sow_id} ยังไม่ได้บันทึกการผสม (สถานะปัจจุบัน: ${targetSow.status})`;
      } else if (step === 3 && targetSow.status !== 'ท้อง') {
        conflictReason = `แม่หมูเบอร์ ${formData.sow_id} ยังไม่ได้บันทึกว่าท้อง (สถานะปัจจุบัน: ${targetSow.status})`;
      } else if (step === 4 && targetSow.status !== 'เลี้ยงลูก') {
        conflictReason = `แม่หมูเบอร์ ${formData.sow_id} ยังไม่ได้บันทึกการคลอด (สถานะปัจจุบัน: ${targetSow.status})`;
      }

      if (conflictReason) {
        setWarning({
          title: "แจ้งเตือนสถานะซ้ำซ้อน",
          message: conflictReason,
          onConfirm: () => handleSubmit(undefined, true)
        });
        return;
      }
    }

    let action = "recordBreeding";
    // Convert date to dd-MM-yyyy before sending to API
    const displayDate = formatDate(formData.date);
    let payload: any = { ...formData, date: displayDate, cycle_id: 'C' + Date.now() };

    if (step === 2) action = "recordMonitoring";
    if (step === 3) action = "recordFarrowing";
    if (step === 4) action = "recordWeaning";

    const res = await callApi(action, payload);
    if (res.status === "success") {
      alert("บันทึกข้อมูลสำเร็จ!");
      onRefresh();
      setFormData({
        sow_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        breeding_type: 'natural',
        boar_id: '',
        semen_id: '',
        technician: '',
        result: 'ท้อง',
        live_born: 0,
        stillborn: 0,
        mummy: 0,
        birth_weight: 0,
        wean_count: 0,
        wean_weight: 0
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">บันทึกวงจรการผลิต</h1>
      </header>

      <div className="px-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 1, label: '1. การผสม', icon: Activity },
          { id: 2, label: '2. ตรวจท้อง', icon: CheckCircle2 },
          { id: 3, label: '3. การคลอด', icon: Calendar },
          { id: 4, label: '4. การหย่านม', icon: ClipboardList }
        ].map((s) => (
          <button 
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`px-4 py-3 rounded-2xl whitespace-nowrap text-sm font-bold transition-all flex items-center gap-2 ${
              step === s.id ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            <s.icon size={16} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              {step === 1 && <Activity size={20} />}
              {step === 2 && <CheckCircle2 size={20} />}
              {step === 3 && <Calendar size={20} />}
              {step === 4 && <ClipboardList size={20} />}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {step === 1 && "บันทึกการผสม"}
              {step === 2 && "บันทึกผลตรวจท้อง"}
              {step === 3 && "บันทึกการคลอด"}
              {step === 4 && "บันทึกการหย่านม"}
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">เบอร์หูแม่หมู</label>
              <select 
                required
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={formData.sow_id}
                onChange={e => setFormData({...formData, sow_id: e.target.value})}
              >
                <option value="">-- เลือกเบอร์หู --</option>
                {sows.filter(s => {
                  if (step === 1) return s.status === 'ว่าง';
                  if (step === 2) return s.status === 'ผสมแล้ว';
                  if (step === 3) return s.status === 'ท้อง';
                  if (step === 4) return s.status === 'เลี้ยงลูก';
                  return false;
                }).length > 0 ? (
                  sows.filter(s => {
                    if (step === 1) return s.status === 'ว่าง';
                    if (step === 2) return s.status === 'ผสมแล้ว';
                    if (step === 3) return s.status === 'ท้อง';
                    if (step === 4) return s.status === 'เลี้ยงลูก';
                    return false;
                  }).map(s => (
                    <option key={s.sow_id} value={s.sow_id}>
                      {s.sow_id} ({s.status})
                    </option>
                  ))
                ) : (
                  <option disabled>ไม่พบแม่หมูที่มีสถานะเหมาะสม</option>
                )}
              </select>
              <p className="text-[10px] text-gray-400 mt-1 ml-1">
                * แสดงเฉพาะแม่หมูที่มีสถานะเหมาะสมสำหรับขั้นตอนนี้
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">วันที่ดำเนินการ</label>
              <input 
                type="date" 
                required
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>

            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, breeding_type: 'natural'})}
                    className={`p-4 rounded-2xl font-bold border-2 transition-all ${
                      formData.breeding_type === 'natural' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    ผสมพ่อพันธุ์
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, breeding_type: 'ai'})}
                    className={`p-4 rounded-2xl font-bold border-2 transition-all ${
                      formData.breeding_type === 'ai' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    ผสมเทียม
                  </button>
                </div>

                {formData.breeding_type === 'natural' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">เบอร์พ่อพันธุ์</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="เช่น B123"
                      value={formData.boar_id}
                      onChange={e => setFormData({...formData, boar_id: e.target.value})}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">รหัสน้ำเชื้อ</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="เช่น AI-999"
                      value={formData.semen_id}
                      onChange={e => setFormData({...formData, semen_id: e.target.value})}
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">ผู้ผสม (Technician)</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="ชื่อคนงาน"
                    value={formData.technician}
                    onChange={e => setFormData({...formData, technician: e.target.value})}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">ผลการตรวจ</label>
                <select 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.result}
                  onChange={e => setFormData({...formData, result: e.target.value})}
                >
                  <option value="ท้อง">ท้อง (Pregnant)</option>
                  <option value="ไม่ท้อง">ไม่ท้อง (Open)</option>
                  <option value="แท้ง">แท้ง (Aborted)</option>
                </select>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">ลูกเกิดมีชีวิต (Live Born)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.live_born}
                    onChange={e => setFormData({...formData, live_born: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">ตายโคม (Stillborn)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.stillborn}
                    onChange={e => setFormData({...formData, stillborn: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">มัมมี่ (Mummy)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.mummy}
                    onChange={e => setFormData({...formData, mummy: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">จำนวนลูกที่หย่า</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.wean_count}
                    onChange={e => setFormData({...formData, wean_count: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">น้ำหนักรวม (กก.)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.wean_weight}
                    onChange={e => setFormData({...formData, wean_weight: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold shadow-xl active:scale-95 transition-all mt-4">
            บันทึกข้อมูล
          </button>
        </form>
      </div>

      <ConfirmationModal 
        isOpen={!!warning}
        onClose={() => setWarning(null)}
        onConfirm={warning?.onConfirm}
        title={warning?.title}
        message={warning?.message}
        confirmText="ยืนยันการเปลี่ยนแปลง"
        cancelText="ยกเลิก"
        type="danger"
      />
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({ username: '', password: '' });
  const [sows, setSows] = useState<Sow[]>([]);
  const [selectedSowId, setSelectedSowId] = useState<string | null>(null);

  const fetchSows = async () => {
    const res = await callApi<Sow[]>("getSows");
    if (res.status === "success" && res.data) setSows(res.data);
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchSows();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Activity size={40} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Sow</h1>
            <p className="text-gray-500">ระบบบริหารจัดการแม่พันธุ์อัจฉริยะ</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="ชื่อผู้ใช้งาน"
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
              value={user.username}
              onChange={e => setUser({...user, username: e.target.value})}
            />
            <input 
              type="password" 
              placeholder="รหัสผ่าน"
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
              value={user.password}
              onChange={e => setUser({...user, password: e.target.value})}
            />
            <button 
              onClick={() => setIsLoggedIn(true)}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-colors"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <main className="max-w-lg mx-auto bg-white min-h-screen shadow-xl relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                onViewHistory={(sowId) => {
                  setSelectedSowId(sowId);
                  setActiveTab('sows');
                }} 
              />
            )}
            {activeTab === 'sows' && (
              <SowMaster 
                sows={sows} 
                onRefresh={fetchSows} 
                selectedSowId={selectedSowId}
                onSelectSow={setSelectedSowId}
              />
            )}
            {activeTab === 'recording' && <CycleRecording sows={sows} onRefresh={fetchSows} />}
            {activeTab === 'settings' && (
              <div className="p-6 space-y-6">
                <h1 className="text-2xl font-bold">ตั้งค่าระบบ</h1>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
                    <span>วันอุ้มท้อง (ปกติ)</span>
                    <span className="font-bold">114 วัน</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
                    <span>เกณฑ์คัดทิ้ง (Parity)</span>
                    <span className="font-bold">{">"} 7</span>
                  </div>
                  <button 
                    onClick={() => setIsLoggedIn(false)}
                    className="w-full flex items-center justify-center gap-2 p-4 text-red-600 font-bold"
                  >
                    <LogOut size={20} /> ออกจากระบบ
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 py-3 flex justify-between items-center max-w-lg mx-auto z-50">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold">หน้าแรก</span>
          </button>
          <button 
            onClick={() => setActiveTab('sows')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'sows' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <Users size={24} />
            <span className="text-[10px] font-bold">ทะเบียน</span>
          </button>
          <button 
            onClick={() => setActiveTab('recording')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'recording' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <ClipboardList size={24} />
            <span className="text-[10px] font-bold">บันทึก</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <SettingsIcon size={24} />
            <span className="text-[10px] font-bold">ตั้งค่า</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
