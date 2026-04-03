import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Home, 
  Users, 
  CreditCard, 
  PlusCircle, 
  ChevronRight,
  TrendingUp,
  DoorOpen,
  UserCheck,
  Filter,
  Search,
  Download,
  Menu,
  X,
  Edit,
  Trash2,
  LogOut,
  Bell,
  Plus,
  History,
  Wrench,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Settings,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface Room {
  id: number;
  room_number: string;
  floor: string;
  type: string;
  capacity: number;
  price: number;
  status: string;
  current_occupancy: number;
}

interface Boarder {
  id: number;
  name: string;
  age: number;
  contact_number: string;
  address: string;
  workplace: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  room_number?: string;
  rental_id?: number;
}

interface Payment {
  id: number;
  boarder_name: string;
  room_number: string;
  amount: number;
  payment_date: string;
  type: string;
  month: string;
}

interface Reminder {
  id: number;
  boarder_id: number;
  boarder_name: string;
  sent_at: string;
  type: string;
  message: string;
}

interface Stats {
  totalRooms: number;
  occupiedRooms: number;
  totalIncome: number;
  activeBoarders: number;
}

interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  details: string;
  timestamp: string;
}

interface MaintenanceRequest {
  id: number;
  room_id: number;
  room_number: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

interface User {
  id: number;
  username: string;
  role: string;
  boarder_id?: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('boarding_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [boarders, setBoarders] = useState<Boarder[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [showAddBoarder, setShowAddBoarder] = useState(false);
  const [showAddRental, setShowAddRental] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [editingBoarder, setEditingBoarder] = useState<Boarder | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomFilter, setRoomFilter] = useState({ floor: 'All', type: 'All', status: 'All' });
  const [boarderFilter, setBoarderFilter] = useState('All'); // 'All', 'Active', 'Inactive'

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [activeTab, user]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('boarding_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('boarding_user');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          currentPassword: passwordData.current,
          newPassword: passwordData.new
        })
      });
      if (res.ok) {
        setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
        setPasswordData({ current: '', new: '', confirm: '' });
        setTimeout(() => setShowChangePassword(false), 2000);
      } else {
        const data = await res.json();
        setPasswordStatus({ type: 'error', message: data.error || 'Failed to update password' });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', message: 'Network error' });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, roomsRes, boardersRes, paymentsRes, remindersRes, logsRes, maintenanceRes, usersRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/rooms'),
        fetch('/api/boarders'),
        fetch('/api/payments'),
        fetch('/api/reminders'),
        fetch('/api/audit-logs'),
        fetch('/api/maintenance'),
        fetch('/api/users')
      ]);
      
      setStats(await statsRes.json());
      setRooms(await roomsRes.json());
      setBoarders(await boardersRes.json());
      setPayments(await paymentsRes.json());
      setReminders(await remindersRes.json());
      setAuditLogs(await logsRes.json());
      setMaintenance(await maintenanceRes.json());
      setUsers(await usersRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendReminder = async (boarder: Boarder) => {
    const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
    const message = `Hi ${boarder.name}, this is a friendly reminder that your rent for ${currentMonthName} is due. Please settle it at your earliest convenience. Thank you!`;
    
    try {
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boarder_id: boarder.id, message })
      });
      
      if (res.ok) {
        alert(`Reminder sent to ${boarder.name}!`);
        fetchData();
      }
    } catch (error) {
      alert('Failed to send reminder');
    }
  };

  const renderDashboard = () => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    if (user?.role === 'boarder') {
      const myBoarder = boarders.find(b => b.id === user.boarder_id);
      const myPayments = payments.filter(p => p.boarder_name === myBoarder?.name);
      const isPaid = myPayments.some(p => p.month === currentMonth && p.type === 'rent');
      const myRoom = rooms.find(r => r.room_number === myBoarder?.room_number);

      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl">
            <h2 className="text-3xl font-black mb-2">Welcome, {myBoarder?.name}!</h2>
            <p className="text-blue-100 font-medium">Here is your current boarding status.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                <Home className="text-blue-600" size={24} />
              </div>
              <h3 className="text-slate-500 text-sm font-bold uppercase mb-1">Your Room</h3>
              <p className="text-2xl font-black text-slate-800">{myRoom ? `Room ${myRoom.room_number}` : 'Not Assigned'}</p>
              <p className="text-xs text-slate-400 mt-1">{myRoom ? `${myRoom.type} • ${myRoom.floor} Floor` : 'Contact host'}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isPaid ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <CreditCard className={isPaid ? 'text-emerald-600' : 'text-red-600'} size={24} />
              </div>
              <h3 className="text-slate-500 text-sm font-bold uppercase mb-1">Rent Status</h3>
              <p className={`text-2xl font-black ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPaid ? 'Paid' : 'Due'}
              </p>
              <p className="text-xs text-slate-400 mt-1">{currentMonth}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="text-purple-600" size={24} />
              </div>
              <h3 className="text-slate-500 text-sm font-bold uppercase mb-1">Monthly Rent</h3>
              <p className="text-2xl font-black text-slate-800">LKR {myRoom?.price?.toLocaleString() || '0'}</p>
              <p className="text-xs text-slate-400 mt-1">Fixed monthly rate</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Your Recent Payments</h3>
            <div className="space-y-4">
              {myPayments.length === 0 ? (
                <p className="text-center py-8 text-slate-400">No payment history found.</p>
              ) : (
                myPayments.slice(0, 5).map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <CreditCard className="text-blue-500" size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 capitalize">{payment.type} Payment</p>
                        <p className="text-xs text-slate-400">{payment.payment_date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-800">LKR {payment.amount.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{payment.month}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    const activeBoardersList = boarders.filter(b => !!b.rental_id);
    const paidBoarders = activeBoardersList.filter(b => 
      payments.some(p => p.boarder_name === b.name && p.month === currentMonth && p.type === 'rent')
    );
    const dueBoarders = activeBoardersList.filter(b => 
      !payments.some(p => p.boarder_name === b.name && p.month === currentMonth && p.type === 'rent')
    );

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {user?.role === 'admin' && (
            <StatCard 
              title="Total Income" 
              value={`LKR ${stats?.totalIncome?.toLocaleString() ?? '0'}`} 
              icon={<TrendingUp className="text-emerald-500" />} 
              trend="+12% from last month"
            />
          )}
          <StatCard 
            title="Occupancy Rate" 
            value={`${stats ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0}%`} 
            icon={<Home className="text-blue-500" />} 
            trend={`${stats?.occupiedRooms}/${stats?.totalRooms} Rooms`}
          />
          <StatCard 
            title="Active Boarders" 
            value={stats?.activeBoarders.toString() || '0'} 
            icon={<UserCheck className="text-blue-500" />} 
            trend={`${paidBoarders.length} Paid / ${dueBoarders.length} Due`}
          />
          <StatCard 
            title="Available Slots" 
            value={(stats ? stats.totalRooms - stats.occupiedRooms : 0).toString()} 
            icon={<DoorOpen className="text-orange-500" />} 
            trend="Ready for rent"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
              <span>Recent Payments</span>
              {user?.role === 'admin' && (
                <button onClick={() => setActiveTab('payments')} className="text-xs text-blue-600 hover:underline">View All</button>
              )}
            </h3>
            <div className="space-y-4">
              {payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                      {payment.boarder_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{payment.boarder_name}</p>
                      <p className="text-xs text-slate-500">Room {payment.room_number} • {payment.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">LKR {payment.amount}</p>
                    <p className="text-xs text-slate-400">{payment.payment_date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-4 text-red-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={20} />
                Pending Payments
              </div>
              {dueBoarders.length > 0 && (
                <button 
                  onClick={async () => {
                    if (confirm(`Send reminders to all ${dueBoarders.length} boarders?`)) {
                      for (const b of dueBoarders) {
                        await sendReminder(b);
                      }
                    }
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200"
                >
                  Remind All
                </button>
              )}
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {dueBoarders.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">All payments are up to date! 🎉</p>
              ) : (
                dueBoarders.map(boarder => (
                  <div key={boarder.id} className="p-3 bg-red-50/50 border border-red-100 rounded-xl">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-slate-800">{boarder.name}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">DUE</span>
                        <button 
                          onClick={() => sendReminder(boarder)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          title="Send Reminder"
                        >
                          <Bell size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Room {boarder.room_number} • {currentMonth}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-4">Floor Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['Ground', '2nd', '3rd'].map(floor => {
              const floorRooms = rooms.filter(r => r.floor === floor);
              const occupied = floorRooms.filter(r => r.status === 'occupied').length;
              return (
                <div key={floor} className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{floor} Floor</span>
                    <span className="text-slate-500">{occupied}/{floorRooms.length} Full</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-500" 
                      style={{ width: `${(occupied / floorRooms.length) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">User Accounts</h2>
            <p className="text-slate-500 text-sm">Manage system access for staff and boarders</p>
          </div>
          <button 
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={20} />
            Add Staff/Administrator
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Username</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Role</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Linked Entity</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">No user accounts found.</td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{u.username}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                        u.role === 'staff' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {u.role === 'admin' ? 'Administrator' : u.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {u.boarder_name ? `Boarder: ${u.boarder_name}` : 'System User'}
                    </td>
                    <td className="p-4">
                      {u.username !== 'admin' && (
                        <button 
                          onClick={async () => {
                            if (confirm(`Delete user account for ${u.username}?`)) {
                              try {
                                const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  fetchData();
                                } else {
                                  const data = await res.json();
                                  alert(data.error || 'Failed to delete user');
                                }
                              } catch (err) {
                                alert('Network error');
                              }
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRooms = () => {
    if (user?.role === 'boarder') return null;
    const floors = ['Ground', '2nd', '3rd'];
    const filteredRooms = rooms.filter(r => {
      const floorMatch = roomFilter.floor === 'All' || r.floor === roomFilter.floor;
      const typeMatch = roomFilter.type === 'All' || r.type === roomFilter.type;
      const statusMatch = roomFilter.status === 'All' || r.status === roomFilter.status;
      const searchMatch = r.room_number.toLowerCase().includes(searchQuery.toLowerCase());
      return floorMatch && typeMatch && statusMatch && searchMatch;
    });

    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Room Management</h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <select 
              className="p-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={roomFilter.floor}
              onChange={(e) => setRoomFilter({ ...roomFilter, floor: e.target.value })}
            >
              <option value="All">All Floors</option>
              <option value="Ground">Ground</option>
              <option value="2nd">2nd Floor</option>
              <option value="3rd">3rd Floor</option>
            </select>
            <select 
              className="p-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={roomFilter.type}
              onChange={(e) => setRoomFilter({ ...roomFilter, type: e.target.value })}
            >
              <option value="All">All Types</option>
              <option value="single">Single</option>
              <option value="sharing">Sharing</option>
            </select>
            <select 
              className="p-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={roomFilter.status}
              onChange={(e) => setRoomFilter({ ...roomFilter, status: e.target.value })}
            >
              <option value="All">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
            </select>
          </div>
        </div>

        {floors.filter(f => roomFilter.floor === 'All' || f === roomFilter.floor).map(floor => {
          const floorRooms = filteredRooms.filter(r => r.floor === floor);
          if (floorRooms.length === 0) return null;
          return (
            <div key={floor} className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-600 flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-500 rounded-full" />
                {floor} Floor
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {floorRooms.map(room => (
                  <motion.div 
                    key={room.id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      room.status === 'occupied' 
                      ? 'border-blue-100 bg-blue-50/30' 
                      : room.current_occupancy > 0
                      ? 'border-emerald-100 bg-emerald-50/10 hover:border-emerald-300'
                      : 'border-slate-100 bg-white hover:border-emerald-200'
                    }`}
                    onClick={() => {
                      if (room.status === 'available') {
                        setSelectedRoom(room);
                        setShowAddRental(true);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-slate-800">{room.room_number}</span>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{room.floor} Floor</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          room.status === 'occupied' ? 'bg-blue-100 text-blue-600' : 
                          room.current_occupancy > 0 ? 'bg-emerald-50 text-emerald-600' :
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                          {room.status === 'occupied' ? 'Full' : room.current_occupancy > 0 ? 'Partial' : 'Available'}
                        </span>
                        {user?.role === 'admin' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRoom(room);
                              setShowEditRoom(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-1 capitalize">{room.type} Room ({room.current_occupancy}/{room.capacity})</p>
                    <p className="text-sm font-semibold text-slate-700">LKR {room.price}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBoarders = () => {
    if (user?.role === 'boarder') return null;
    const filteredBoarders = boarders.filter(b => {
      const statusMatch = boarderFilter === 'All' || 
                         (boarderFilter === 'Active' ? !!b.rental_id : !b.rental_id);
      const searchMatch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (b.room_number?.toLowerCase().includes(searchQuery.toLowerCase()));
      return statusMatch && searchMatch;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Boarders</h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <select 
              className="p-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={boarderFilter}
              onChange={(e) => setBoarderFilter(e.target.value)}
            >
              <option value="All">All Boarders</option>
              <option value="Active">Active (Renting)</option>
              <option value="Inactive">Inactive (Not Renting)</option>
            </select>
            <button 
              onClick={() => {
                setEditingBoarder(null);
                setShowAddBoarder(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <PlusCircle size={18} /> Add New Boarder
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-bottom border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Name</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Room</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Contact</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Workplace</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Emergency</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Login Info</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Payment Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBoarders.map(boarder => (
                <tr key={boarder.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{boarder.name}</div>
                    <div className="text-xs text-slate-400">{boarder.age} years old</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      boarder.rental_id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {boarder.rental_id ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                  {boarder.room_number ? (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                      Room {boarder.room_number}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">Not Assigned</span>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-600">{boarder.contact_number}</td>
                <td className="p-4 text-sm text-slate-600">{boarder.workplace}</td>
                <td className="p-4">
                  <div className="text-sm font-medium text-slate-700">{boarder.emergency_contact_name}</div>
                  <div className="text-xs text-slate-400">{boarder.emergency_contact_phone}</div>
                </td>
                <td className="p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">User: {boarder.name.toLowerCase().replace(/\s+/g, '')}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Pass: {boarder.contact_number}</div>
                </td>
                <td className="p-4">
                  {boarder.rental_id ? (
                    (() => {
                      const currentMonth = new Date().toISOString().substring(0, 7);
                      const paid = payments.some(p => p.boarder_name === boarder.name && p.month === currentMonth && p.type === 'rent');
                      return (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          paid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {paid ? 'Paid' : 'Due'}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingBoarder(boarder);
                        setShowAddBoarder(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    {user?.role === 'admin' && (
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this boarder? This will remove all their history.')) {
                            try {
                              const res = await fetch(`/api/boarders/${boarder.id}`, { method: 'DELETE' });
                              if (!res.ok) {
                                const err = await res.json();
                                alert(err.error || 'Failed to delete boarder. They might have rental history.');
                              } else {
                                await fetchData();
                              }
                            } catch (err) {
                              alert('Network error while deleting boarder');
                            }
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {boarder.rental_id && (
                      <button 
                        onClick={async () => {
                          if (confirm(`End rental for ${boarder.name} and free up room ${boarder.room_number}?`)) {
                            try {
                              const res = await fetch(`/api/rentals/end/${boarder.rental_id}`, { method: 'POST' });
                              if (res.ok) {
                                await fetchData();
                              } else {
                                alert('Failed to end rental');
                              }
                            } catch (err) {
                              alert('Network error while ending rental');
                            }
                          }
                        }}
                        title="End Rental"
                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      >
                        <LogOut size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 lg:static ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Home className="text-white" size={24} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">BoardingHouse</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X size={24} />
            </button>
          </div>

          <nav className="space-y-1">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
            />
            {user?.role !== 'boarder' && (
              <>
                <NavItem 
                  active={activeTab === 'rooms'} 
                  onClick={() => { setActiveTab('rooms'); setIsSidebarOpen(false); }}
                  icon={<Home size={20} />} 
                  label="Rooms & Floors" 
                />
                <NavItem 
                  active={activeTab === 'boarders'} 
                  onClick={() => { setActiveTab('boarders'); setIsSidebarOpen(false); }}
                  icon={<Users size={20} />} 
                  label="Boarders" 
                />
                <NavItem 
                  active={activeTab === 'payments'} 
                  onClick={() => { setActiveTab('payments'); setIsSidebarOpen(false); }}
                  icon={<CreditCard size={20} />} 
                  label="Payments" 
                />
              </>
            )}
            
            <NavItem 
              active={activeTab === 'maintenance'} 
              onClick={() => { setActiveTab('maintenance'); setIsSidebarOpen(false); }}
              icon={<Wrench size={20} />} 
              label="Maintenance" 
            />

            {user?.role === 'admin' && (
              <>
                <div className="pt-4 pb-2 px-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Host Tools</p>
                </div>
                <NavItem 
                  active={activeTab === 'reports'} 
                  onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
                  icon={<TrendingUp size={20} />} 
                  label="Financial Reports" 
                />
                <NavItem 
                  active={activeTab === 'reminders'} 
                  onClick={() => { setActiveTab('reminders'); setIsSidebarOpen(false); }}
                  icon={<Bell size={20} />} 
                  label="Reminder History" 
                />
                <NavItem 
                  active={activeTab === 'audit'} 
                  onClick={() => { setActiveTab('audit'); setIsSidebarOpen(false); }}
                  icon={<History size={20} />} 
                  label="Activity Log" 
                />
                <NavItem 
                  active={activeTab === 'users'} 
                  onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
                  icon={<UserIcon size={20} />} 
                  label="User Accounts" 
                />
              </>
            )}

            <div className="pt-4 pb-2 px-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</p>
            </div>
            <NavItem 
              active={activeTab === 'settings'} 
              onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              icon={<Settings size={20} />} 
              label="Settings" 
            />
            <NavItem 
              active={activeTab === 'guide'} 
              onClick={() => { setActiveTab('guide'); setIsSidebarOpen(false); }}
              icon={<HelpCircle size={20} />} 
              label="User Guide" 
            />
          </nav>
          
          <button 
            onClick={handleLogout}
            className="mt-4 flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all w-full text-left font-bold text-sm"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
              <UserIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.username}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-white border border-slate-200 rounded-xl text-slate-600">
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 capitalize">{activeTab}</h2>
              <p className="text-slate-500 text-sm">Welcome back, {user.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search rooms or boarders..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full sm:w-64"
              />
            </div>
            <button 
              onClick={() => {
                if (activeTab === 'payments') downloadCSV(payments, 'payments_report.csv');
                if (activeTab === 'boarders') downloadCSV(boarders, 'boarders_report.csv');
                if (activeTab === 'dashboard') downloadCSV([stats], 'dashboard_stats.csv');
              }}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download size={20} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'rooms' && renderRooms()}
            {activeTab === 'boarders' && renderBoarders()}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-800">Payment History</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowAddPayment(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                    >
                      Record Payment
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Boarder</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Room</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Type</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Month</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Amount</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-medium">{p.boarder_name}</td>
                          <td className="p-4 text-slate-600">{p.room_number}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                              p.type === 'rent' ? 'bg-blue-100 text-blue-600' : 
                              p.type === 'advance' ? 'bg-emerald-100 text-emerald-600' : 
                              'bg-orange-100 text-orange-600'
                            }`}>
                              {p.type}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600">{p.month}</td>
                          <td className="p-4 font-bold">LKR {p.amount}</td>
                          <td className="p-4 text-slate-400 text-sm">{p.payment_date}</td>
                          <td className="p-4">
                            {user?.role === 'admin' && (
                              <button 
                                onClick={async () => {
                                  if (confirm('Delete this payment record?')) {
                                    await fetch(`/api/payments/${p.id}`, { method: 'DELETE' });
                                    fetchData();
                                  }
                                }}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'reminders' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-800">Reminder History</h2>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Boarder</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Message</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reminders.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-400">No reminders sent yet.</td>
                        </tr>
                      ) : (
                        reminders.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="p-4 font-medium">{r.boarder_name}</td>
                            <td className="p-4 text-sm text-slate-600">{r.message}</td>
                            <td className="p-4 text-slate-400 text-sm">{r.sent_at ? new Date(r.sent_at).toLocaleString() : 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Monthly Revenue</h3>
                    <div className="space-y-4">
                      {Object.entries(
                        payments.reduce((acc: any, p) => {
                          acc[p.month] = (acc[p.month] || 0) + p.amount;
                          return acc;
                        }, {})
                      ).sort().reverse().slice(0, 6).map(([month, total]: any) => (
                        <div key={month} className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-600">{month}</span>
                          <span className="font-bold text-slate-900">LKR {total?.toLocaleString() ?? '0'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm col-span-2">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Yearly Summary</h3>
                    <div className="h-48 flex items-end gap-2 px-4">
                      {/* Simple CSS Bar Chart */}
                      {[65, 80, 45, 90, 70, 85, 60, 75, 95, 80, 70, 90].map((h, i) => (
                        <div key={i} className="flex-1 bg-blue-100 rounded-t-lg relative group">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-lg transition-all duration-500 group-hover:bg-blue-600" 
                            style={{ height: `${h}%` }}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Month {i+1}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase">
                      <span>Jan</span>
                      <span>Jun</span>
                      <span>Dec</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'audit' && user?.role === 'admin' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-800">Activity Log</h2>
                  <button 
                    onClick={() => fetchData()}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    <TrendingUp size={20} />
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {auditLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">No activity recorded yet.</div>
                    ) : (
                      auditLogs.map(log => (
                        <div key={log.id} className="p-4 hover:bg-slate-50/50 flex items-start gap-4">
                          <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-600' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {log.action === 'CREATE' ? <PlusCircle size={16} /> :
                             log.action === 'UPDATE' ? <Edit size={16} /> :
                             <Trash2 size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="font-medium text-slate-800">
                                <span className="font-bold">{log.action}</span> {log.entity_type}
                              </p>
                              <span className="text-xs text-slate-400">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'maintenance' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-800">Maintenance Requests</h2>
                  <button 
                    onClick={() => setShowAddMaintenance(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <PlusCircle size={18} /> New Request
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(() => {
                    const myBoarder = user?.role === 'boarder' ? boarders.find(b => b.id === user.boarder_id) : null;
                    const filteredMaintenance = user?.role === 'boarder' 
                      ? maintenance.filter(req => req.room_number === myBoarder?.room_number)
                      : maintenance;

                    if (filteredMaintenance.length === 0) {
                      return (
                        <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                          No maintenance requests found.
                        </div>
                      );
                    }

                    return filteredMaintenance.map(req => (
                      <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${
                          req.priority === 'high' ? 'bg-red-500' :
                          req.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-slate-800">Room {req.room_number}</h3>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">{new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                            req.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                            req.status === 'in_progress' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {req.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-6 line-clamp-3">{req.description}</p>
                        <div className="flex gap-2">
                          {user?.role !== 'boarder' && req.status !== 'completed' && (
                            <button 
                              onClick={async () => {
                                const nextStatus = req.status === 'pending' ? 'in_progress' : 'completed';
                                await fetch(`/api/maintenance/${req.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: nextStatus })
                                });
                                fetchData();
                              }}
                              className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                            >
                              {req.status === 'pending' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                              {req.status === 'pending' ? 'Start' : 'Complete'}
                            </button>
                          )}
                          {user?.role !== 'boarder' && (
                            <button 
                              onClick={async () => {
                                if (confirm('Delete this request?')) {
                                  await fetch(`/api/maintenance/${req.id}`, { method: 'DELETE' });
                                  await fetchData();
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
            {activeTab === 'users' && user?.role === 'admin' && renderUsers()}
            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                      <UserIcon size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">{user?.username}</h2>
                      <p className="text-slate-500 font-medium capitalize">{user?.role} Account</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Password</p>
                        <p className="text-xs text-slate-500">Security & Privacy</p>
                      </div>
                      <button 
                        onClick={() => setShowChangePassword(true)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Change Password
                      </button>
                    </div>
                  </div>
                </div>

                {showChangePassword && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
                  >
                    <h3 className="text-xl font-black text-slate-800 mb-6">Change Password</h3>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      {passwordStatus.message && (
                        <div className={`p-4 rounded-2xl text-sm font-medium ${passwordStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {passwordStatus.message}
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Current Password</label>
                        <input 
                          type="password" 
                          required
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                          value={passwordData.current}
                          onChange={e => setPasswordData({...passwordData, current: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">New Password</label>
                          <input 
                            type="password" 
                            required
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                            value={passwordData.new}
                            onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Confirm New Password</label>
                          <input 
                            type="password" 
                            required
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                            value={passwordData.confirm}
                            onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button 
                          type="submit"
                          className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors"
                        >
                          Update Password
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowChangePassword(false)}
                          className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </div>
            )}
            {activeTab === 'guide' && (
              <div className="space-y-8 max-w-4xl">
                <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                  <h2 className="text-3xl font-bold mb-2">
                    {user?.role === 'admin' ? 'Host Guide' : 
                     user?.role === 'staff' ? 'Staff Guide' : 'Resident Guide'}
                  </h2>
                  <p className="text-blue-100">
                    {user?.role === 'admin' ? 'Complete control over property management, finances, and users.' :
                     user?.role === 'staff' ? 'Manage daily operations, boarders, and maintenance tasks.' :
                     'Manage your stay, track payments, and request maintenance.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {user?.role === 'boarder' ? (
                    <>
                      <GuideSection 
                        icon={<LayoutDashboard className="text-blue-500" />}
                        title="1. Your Dashboard"
                        content="View your assigned room details, monthly rent amount, and current payment status (Paid/Due). You can also see your last 5 payment records."
                      />
                      <GuideSection 
                        icon={<Wrench className="text-blue-500" />}
                        title="2. Request Maintenance"
                        content="If something in your room needs fixing, go to the 'Maintenance' tab and click 'New Request'. Describe the issue and set a priority."
                      />
                      <GuideSection 
                        icon={<Settings className="text-blue-500" />}
                        title="3. Account Settings"
                        content="Keep your account secure by changing your password regularly in the 'Settings' tab."
                      />
                    </>
                  ) : (
                    <>
                      <GuideSection 
                        icon={<LayoutDashboard className="text-blue-500" />}
                        title="1. Dashboard Overview"
                        content={user?.role === 'admin' 
                          ? "Monitor total income, occupancy rates, and active boarders. Send reminders to boarders who haven't paid."
                          : "Monitor occupancy rates and active boarders. Track pending payments and send reminders."}
                      />
                      <GuideSection 
                        icon={<Home className="text-blue-500" />}
                        title="2. Managing Rooms"
                        content="View building layout and room status. Staff can view details, while Admins can edit prices and capacity."
                      />
                      <GuideSection 
                        icon={<Users className="text-blue-500" />}
                        title="3. Boarder Management"
                        content="Register new boarders and assign them to rooms. Track their contact info and emergency details."
                      />
                      <GuideSection 
                        icon={<CreditCard className="text-blue-500" />}
                        title="4. Payments & Billing"
                        content="Record Rent, Water, or Electricity payments. View full payment history for all boarders."
                      />
                      <GuideSection 
                        icon={<Wrench className="text-blue-500" />}
                        title="5. Maintenance Tracking"
                        content="Log and track maintenance issues. Update status from 'Pending' to 'In Progress' and 'Completed'."
                      />
                      {user?.role === 'admin' && (
                        <GuideSection 
                          icon={<History className="text-blue-500" />}
                          title="6. Audit & Security"
                          content="Every administrative action is recorded in the 'Activity Log'. Manage system users in 'User Accounts'."
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="bg-slate-800 p-8 rounded-3xl text-white">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-orange-400" />
                    Pro Tips
                  </h3>
                  <ul className="space-y-3 text-slate-300 text-sm">
                    {user?.role !== 'boarder' && <li>• Use the <strong>Search Bar</strong> to quickly find boarders or rooms.</li>}
                    {user?.role !== 'boarder' && <li>• Click the <strong>Download</strong> icon to export data to CSV.</li>}
                    <li>• Keep your <strong>Password</strong> updated for better security.</li>
                  </ul>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      {showEditRoom && editingRoom && (
        <Modal title="Edit Room Details" onClose={() => setShowEditRoom(false)}>
          <RoomEditForm 
            room={editingRoom} 
            onSubmit={async (data) => {
              await fetch(`/api/rooms/${editingRoom.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              setShowEditRoom(false);
              fetchData();
            }} 
          />
        </Modal>
      )}

      {showAddMaintenance && (
        <Modal title="New Maintenance Request" onClose={() => setShowAddMaintenance(false)}>
          <MaintenanceForm 
            rooms={rooms}
            onSubmit={async (data) => {
              await fetch('/api/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              setShowAddMaintenance(false);
              fetchData();
            }}
          />
        </Modal>
      )}
      {showAddBoarder && (
        <Modal title={editingBoarder ? "Edit Boarder" : "Add New Boarder"} onClose={() => setShowAddBoarder(false)}>
          <BoarderForm 
            initialData={editingBoarder}
            onSubmit={async (data) => {
              const url = editingBoarder ? `/api/boarders/${editingBoarder.id}` : '/api/boarders';
              const method = editingBoarder ? 'PUT' : 'POST';
              await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              setShowAddBoarder(false);
              setEditingBoarder(null);
              fetchData();
            }} 
          />
        </Modal>
      )}

      {showAddRental && selectedRoom && (
        <Modal title={`Rent Room ${selectedRoom.room_number}`} onClose={() => setShowAddRental(false)}>
          <RentalForm 
            room={selectedRoom} 
            boarders={boarders.filter(b => !b.room_number)}
            onSubmit={async (data) => {
              await fetch('/api/rentals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, room_id: selectedRoom.id })
              });
              setShowAddRental(false);
              fetchData();
            }} 
          />
        </Modal>
      )}

      {showAddPayment && (
        <Modal title="Record Payment" onClose={() => setShowAddPayment(false)}>
          <PaymentForm 
            boarders={boarders.filter(b => b.rental_id)}
            onSubmit={async (data) => {
              await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              setShowAddPayment(false);
              fetchData();
            }} 
          />
        </Modal>
      )}

      {showAddUser && (
        <Modal title="Add System User" onClose={() => setShowAddUser(false)}>
          <UserForm 
            onSubmit={async (data) => {
              const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              if (res.ok) {
                setShowAddUser(false);
                fetchData();
              } else {
                const err = await res.json();
                alert(err.error || 'Failed to create user');
              }
            }} 
          />
        </Modal>
      )}
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
        ? 'bg-blue-50 text-blue-600 font-semibold' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
      {active && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />}
    </button>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-xl">
          {icon}
        </div>
      </div>
      <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 mb-2">{value}</p>
      <p className="text-xs text-slate-400 font-medium">{trend}</p>
    </div>
  );
}

function GuideSection({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="font-bold text-slate-800 mb-2">{title}</h4>
      <p className="text-sm text-slate-500 leading-relaxed">{content}</p>
    </div>
  );
}

function UserForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'staff'
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Username</label>
        <input 
          required 
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          value={formData.username} 
          onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '')})}
          placeholder="e.g. staff_john"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
        <input 
          required 
          type="password"
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          value={formData.password} 
          onChange={e => setFormData({...formData, password: e.target.value})}
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Role</label>
        <select 
          required 
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          value={formData.role} 
          onChange={e => setFormData({...formData, role: e.target.value})}
        >
          <option value="staff">Staff Member</option>
          <option value="admin">Host (Owner)</option>
        </select>
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
        Create User Account
      </button>
    </form>
  );
}

function MaintenanceForm({ rooms, onSubmit }: { rooms: Room[], onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    room_id: '',
    description: '',
    priority: 'medium'
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Room</label>
        <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.room_id} onChange={e => setFormData({...formData, room_id: e.target.value})}>
          <option value="">Select Room...</option>
          {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Priority</label>
        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
        <textarea required placeholder="Describe the issue..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-32" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
        Submit Request
      </button>
    </form>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function BoarderForm({ initialData, onSubmit }: { initialData?: Boarder | null, onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    age: initialData?.age || '',
    contact_number: initialData?.contact_number || '',
    address: initialData?.address || '',
    workplace: initialData?.workplace || '',
    emergency_contact_name: initialData?.emergency_contact_name || '',
    emergency_contact_phone: initialData?.emergency_contact_phone || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation: at least 3 characters, only letters and spaces
    if (formData.name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters long";
    } else if (!/^[A-Za-z\s]+$/.test(formData.name)) {
      newErrors.name = "Name should only contain letters and spaces";
    }

    // Contact number: exactly 10 digits
    if (!/^\d{10}$/.test(formData.contact_number)) {
      newErrors.contact_number = "Contact number must be exactly 10 digits";
    }

    // Emergency contact name
    if (formData.emergency_contact_name.trim().length < 3) {
      newErrors.emergency_contact_name = "Emergency contact name must be at least 3 characters long";
    }

    // Emergency contact phone: exactly 10 digits
    if (!/^\d{10}$/.test(formData.emergency_contact_phone)) {
      newErrors.emergency_contact_phone = "Emergency contact phone must be exactly 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
          <input 
            required 
            className={`w-full p-3 bg-slate-50 border ${errors.name ? 'border-red-500' : 'border-slate-200'} rounded-xl text-sm`} 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
          />
          {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Age</label>
          <input required type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contact</label>
          <input 
            required 
            className={`w-full p-3 bg-slate-50 border ${errors.contact_number ? 'border-red-500' : 'border-slate-200'} rounded-xl text-sm`} 
            value={formData.contact_number} 
            onChange={e => setFormData({...formData, contact_number: e.target.value})} 
          />
          {errors.contact_number && <p className="text-[10px] text-red-500 mt-1">{errors.contact_number}</p>}
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Workplace</label>
        <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.workplace} onChange={e => setFormData({...formData, workplace: e.target.value})} />
      </div>
      <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase">Emergency Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input 
              placeholder="Name" 
              className={`w-full p-2 bg-white border ${errors.emergency_contact_name ? 'border-red-500' : 'border-slate-200'} rounded-lg text-sm`} 
              value={formData.emergency_contact_name} 
              onChange={e => setFormData({...formData, emergency_contact_name: e.target.value})} 
            />
            {errors.emergency_contact_name && <p className="text-[10px] text-red-500 mt-1">{errors.emergency_contact_name}</p>}
          </div>
          <div>
            <input 
              placeholder="Phone" 
              className={`w-full p-2 bg-white border ${errors.emergency_contact_phone ? 'border-red-500' : 'border-slate-200'} rounded-lg text-sm`} 
              value={formData.emergency_contact_phone} 
              onChange={e => setFormData({...formData, emergency_contact_phone: e.target.value})} 
            />
            {errors.emergency_contact_phone && <p className="text-[10px] text-red-500 mt-1">{errors.emergency_contact_phone}</p>}
          </div>
        </div>
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
        Save Boarder
      </button>
    </form>
  );
}

function RoomEditForm({ room, onSubmit }: { room: Room, onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({ ...room });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Room Number</label>
          <input 
            type="text" 
            required 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
            value={formData.room_number} 
            onChange={e => setFormData({...formData, room_number: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monthly Price (LKR)</label>
          <input 
            type="number" 
            required 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600" 
            value={formData.price} 
            onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Floor</label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
            value={formData.floor} 
            onChange={e => setFormData({...formData, floor: e.target.value})}
          >
            <option value="Ground">Ground</option>
            <option value="2nd">2nd</option>
            <option value="3rd">3rd</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Room Type</label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
            value={formData.type} 
            onChange={e => setFormData({...formData, type: e.target.value})}
          >
            <option value="single">Single</option>
            <option value="sharing">Sharing</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Capacity (Persons)</label>
        <input 
          type="number" 
          required 
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          value={formData.capacity} 
          onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} 
        />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mt-2">
        Update Room
      </button>
    </form>
  );
}

function RentalForm({ room, boarders, onSubmit }: { room: Room, boarders: Boarder[], onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    boarder_id: '',
    start_date: new Date().toISOString().split('T')[0],
    advance_months: 1,
    advance_amount: room.price,
    additional_items: ''
  });

  useEffect(() => {
    setFormData(prev => ({ ...prev, advance_amount: room.price * prev.advance_months }));
  }, [formData.advance_months, room.price]);

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Select Boarder</label>
        <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.boarder_id} onChange={e => setFormData({...formData, boarder_id: e.target.value})}>
          <option value="">Choose a boarder...</option>
          {boarders.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Start Date</label>
          <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Advance Months</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.advance_months} onChange={e => setFormData({...formData, advance_months: Number(e.target.value)})}>
            <option value={1}>1 Month</option>
            <option value={2}>2 Months</option>
            <option value={3}>3 Months</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Advance Amount (LKR)</label>
        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600" value={formData.advance_amount} onChange={e => setFormData({...formData, advance_amount: Number(e.target.value)})} />
        <p className="text-[10px] text-slate-400 mt-1">Calculated based on room price: LKR {room.price}/mo</p>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Additional Items Given</label>
        <textarea placeholder="e.g. Bed, Table, Chair" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-24" value={formData.additional_items} onChange={e => setFormData({...formData, additional_items: e.target.value})} />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
        Confirm Rental
      </button>
    </form>
  );
}

function PaymentForm({ boarders, onSubmit }: { boarders: Boarder[], onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    rental_id: '',
    amount: '',
    type: 'rent',
    month: new Date().toISOString().substring(0, 7)
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Select Boarder</label>
        <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.rental_id} onChange={e => setFormData({...formData, rental_id: e.target.value})}>
          <option value="">Choose a boarder...</option>
          {boarders.map(b => <option key={b.id} value={b.rental_id}>{b.name} (Room {b.room_number})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Amount (LKR)</label>
          <input required type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type</label>
          <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="rent">Rent</option>
            <option value="water">Water Bill</option>
            <option value="electricity">Electricity Bill</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Billing Month</label>
        <input type="month" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
        Record Payment
      </button>
    </form>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ database: string; databaseError?: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(() => setDbStatus({ database: 'connection_failed', databaseError: 'Could not reach API' }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      if (res.ok) {
        onLogin(await res.json());
      } else {
        const data = await res.json().catch(() => ({ error: 'Invalid username or password' }));
        setError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Home className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">BoardingHouse</h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1 font-bold">Management System v2.0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl flex items-center gap-2"
            >
              <AlertTriangle size={18} />
              {error}
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Sign in as</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium appearance-none"
              >
                <option value="admin">Administrator (Owner)</option>
                <option value="boarder">Boarder</option>
                <option value="staff">Staff Member</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Username</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                placeholder="Enter your username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? 'Authenticating...' : 'Sign In Now'}
          </button>

          <div className="text-center space-y-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {role === 'boarder' ? 'Tip: Use your name (no spaces) and phone number' : 
               role === 'staff' ? 'Contact admin for your staff credentials' :
               'Administrator access required'}
            </p>
            {dbStatus && dbStatus.database !== 'connected' && (
              <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl text-[9px] text-amber-700 font-bold uppercase tracking-tight">
                System Warning: Database {dbStatus.database.replace(/_/g, ' ')}
                {dbStatus.databaseError && <div className="mt-1 normal-case font-medium opacity-70">{dbStatus.databaseError}</div>}
              </div>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
