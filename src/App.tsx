/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  QrCode, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  ChevronLeft,
  User as UserIcon,
  LogOut,
  Camera,
  Printer,
  Download,
  Menu,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Student = {
  id: string;
  name: string;
  class: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
};

type AttendanceRecord = {
  id: number;
  student_id: string;
  date: string;
  status: string;
  timestamp: string;
};

type View = 'admin' | 'user' | 'scan' | 'login-admin' | 'login-student';

function NavButtons({ view, setView, startScanner, isAdmin, onLogout }: { 
  view: View; 
  setView: (v: View) => void; 
  startScanner: () => void;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const buttons = isAdmin ? [
    { id: 'admin', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan', label: 'Scanner', icon: Camera },
  ] : [
    { id: 'user', label: 'Profil Saya', icon: Users },
  ];

  return (
    <>
      {buttons.map((btn) => (
        <button 
          key={btn.id}
          onClick={() => {
            if (btn.id === 'scan') startScanner();
            setView(btn.id as View);
          }}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 w-full md:w-auto",
            view === btn.id 
              ? "bg-indigo-600 text-white md:bg-white md:text-indigo-600 md:shadow-sm" 
              : "text-[#495057] hover:text-indigo-600 hover:bg-indigo-50 md:hover:bg-transparent"
          )}
        >
          <btn.icon size={18} />
          {btn.label}
        </button>
      ))}
      <button 
        onClick={onLogout}
        className="px-4 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-2 w-full md:w-auto"
      >
        <LogOut size={18} />
        Keluar
      </button>
    </>
  );
}

export default function App() {
  const [view, setView] = useState<View>('login-student');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<AttendanceRecord[]>([]);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [authenticatedStudent, setAuthenticatedStudent] = useState<Student | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Check URL for admin route
    if (window.location.pathname === '/admin') {
      setView('login-admin');
    }
    fetchStudents();
  }, []);

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    setAuthenticatedStudent(null);
    setSelectedStudent(null);
    if (window.location.pathname === '/admin') {
      setView('login-admin');
    } else {
      setView('login-student');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentAttendance = async (studentId: string) => {
    try {
      const res = await fetch(`/api/students/${studentId}/attendance`);
      const data = await res.json();
      setStudentAttendance(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setIsAdminAuthenticated(true);
        setView('admin');
      } else {
        alert('Username atau Password Admin salah');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi');
    }
  };

  const handleStudentLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = formData.get('student_id') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthenticatedStudent(data.student);
        setSelectedStudent(data.student);
        fetchStudentAttendance(data.student.id);
        setView('user');
      } else {
        alert(data.error || 'ID atau Password salah');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi');
    }
  };

  const handleAddOrUpdateStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      id: formData.get('id') as string,
      name: formData.get('name') as string,
      className: formData.get('class') as string,
      password: formData.get('password') as string,
    };

    const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
    const method = editingStudent ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingStudent(null);
        fetchStudents();
      } else {
        const err = await res.json();
        alert(err.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus siswa ini?')) return;
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
      fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  const startScanner = () => {
    setScanResult(null);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }, 100);
  };

  const onScanSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    
    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: decodedText }),
      });
      const data = await res.json();
      setScanResult({ success: res.ok, message: data.message || data.error });
      fetchStudents();
    } catch (err) {
      setScanResult({ success: false, message: 'Gagal memproses QR Code' });
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      {(isAdminAuthenticated || authenticatedStudent) && (
        <nav className="bg-white border-b border-[#E9ECEF] sticky top-0 z-40 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-lg">
                  <QrCode className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="font-bold text-lg sm:text-xl tracking-tight truncate max-w-[120px] sm:max-w-none">QR Absensi</span>
              </div>
              
              {/* Desktop Menu */}
              <div className="hidden md:flex gap-1 bg-[#F1F3F5] p-1 rounded-xl">
                <NavButtons 
                  view={view} 
                  setView={setView} 
                  startScanner={startScanner} 
                  isAdmin={isAdminAuthenticated}
                  onLogout={handleLogout}
                />
              </div>

              {/* Mobile Menu Toggle */}
              <div className="md:hidden">
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-[#495057] hover:bg-[#F1F3F5] rounded-lg transition-all"
                >
                  {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu Overlay */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden bg-white border-t border-[#E9ECEF] overflow-hidden"
              >
                <div className="p-4 flex flex-col gap-2">
                  <NavButtons 
                    view={view} 
                    setView={(v) => { setView(v); setIsMobileMenuOpen(false); }} 
                    startScanner={startScanner} 
                    isAdmin={isAdminAuthenticated}
                    onLogout={handleLogout}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'login-admin' && (
            <motion.div 
              key="login-admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto mt-12"
            >
              <div className="bg-white p-8 rounded-3xl border border-[#E9ECEF] shadow-2xl">
                <div className="text-center mb-8">
                  <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-100">
                    <LayoutDashboard className="text-white" size={32} />
                  </div>
                  <h1 className="text-2xl font-bold">Login Admin</h1>
                  <p className="text-[#868E96]">Masukkan kredensial untuk mengelola sistem.</p>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#495057] mb-1.5">Username</label>
                    <input name="username" type="text" required className="w-full px-4 py-3 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#495057] mb-1.5">Password</label>
                    <input name="password" type="password" required className="w-full px-4 py-3 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 mt-4">
                    Masuk sebagai Admin
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'login-student' && (
            <motion.div 
              key="login-student"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto mt-12"
            >
              <div className="bg-white p-8 rounded-3xl border border-[#E9ECEF] shadow-2xl">
                <div className="text-center mb-8">
                  <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-100">
                    <Users className="text-white" size={32} />
                  </div>
                  <h1 className="text-2xl font-bold">Login Siswa</h1>
                  <p className="text-[#868E96]">Masukkan ID dan Password Anda.</p>
                </div>
                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#495057] mb-1.5">ID Siswa (NIS)</label>
                    <input name="student_id" type="text" required className="w-full px-4 py-3 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#495057] mb-1.5">Password</label>
                    <input name="password" type="password" required className="w-full px-4 py-3 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 mt-4">
                    Masuk
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'admin' && isAdminAuthenticated && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Dashboard Admin</h1>
                  <p className="text-[#868E96]">Kelola data siswa dan pantau kehadiran harian.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingStudent(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-100"
                >
                  <Plus size={20} />
                  Tambah Siswa
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: 'Total Siswa', value: students.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Hadir Hari Ini', value: students.reduce((acc, s) => acc + s.hadir, 0), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Sakit/Izin', value: students.reduce((acc, s) => acc + s.sakit + s.izin, 0), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Alpa', value: students.reduce((acc, s) => acc + s.alpa, 0), icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-3 sm:p-4 rounded-2xl border border-[#E9ECEF] flex items-center gap-3 sm:gap-4 shadow-sm">
                    <div className={cn("p-2 sm:p-3 rounded-xl", stat.bg)}>
                      <stat.icon className={stat.color} size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs font-medium text-[#868E96] uppercase tracking-wider truncate">{stat.label}</p>
                      <p className="text-lg sm:text-xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-[#E9ECEF] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#E9ECEF] flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADB5BD]" size={18} />
                    <input 
                      type="text" 
                      placeholder="Cari nama atau ID siswa..." 
                      className="w-full pl-10 pr-4 py-2 bg-[#F8F9FA] border border-transparent rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Responsive Table/Card List */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#F8F9FA] text-[#495057] text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Siswa</th>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Kelas</th>
                        <th className="px-6 py-4 text-center">Hadir</th>
                        <th className="px-6 py-4 text-center">Sakit</th>
                        <th className="px-6 py-4 text-center">Izin</th>
                        <th className="px-6 py-4 text-center">Alpa</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9ECEF]">
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-[#F8F9FA] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                {student.name.charAt(0)}
                              </div>
                              <span className="font-medium text-sm">{student.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#495057] font-mono text-xs">{student.id}</td>
                          <td className="px-6 py-4 text-[#495057] text-sm">{student.class}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{student.hadir}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{student.sakit}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{student.izin}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{student.alpa}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => {
                                  setEditingStudent(student);
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-[#868E96] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteStudent(student.id)}
                                className="p-2 text-[#868E96] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Hapus"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden divide-y divide-[#E9ECEF]">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{student.name}</p>
                            <p className="text-xs text-[#868E96]">{student.class} • {student.id}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => {
                              setEditingStudent(student);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-[#868E96] hover:bg-indigo-50 rounded-lg"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-2 text-[#868E96] hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'H', val: student.hadir, bg: 'bg-emerald-50', text: 'text-emerald-700' },
                          { label: 'S', val: student.sakit, bg: 'bg-amber-50', text: 'text-amber-700' },
                          { label: 'I', val: student.izin, bg: 'bg-blue-50', text: 'text-blue-700' },
                          { label: 'A', val: student.alpa, bg: 'bg-rose-50', text: 'text-rose-700' },
                        ].map((s, i) => (
                          <div key={i} className={cn("p-2 rounded-xl text-center", s.bg)}>
                            <p className={cn("text-xs font-bold", s.text)}>{s.val}</p>
                            <p className="text-[8px] font-bold opacity-60 uppercase">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'user' && authenticatedStudent && (
            <motion.div 
              key="user"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="text-center">
                <h1 className="text-2xl font-bold">Informasi Kehadiran</h1>
                <p className="text-[#868E96]">Selamat datang kembali, {authenticatedStudent.name}.</p>
              </div>

              {selectedStudent && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E9ECEF] shadow-xl shadow-indigo-50/50 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-4 right-4 print:hidden flex gap-2">
                      <button 
                        onClick={handlePrint}
                        className="p-2 bg-[#F8F9FA] hover:bg-indigo-50 text-[#868E96] hover:text-indigo-600 rounded-xl transition-all"
                        title="Cetak QR"
                      >
                        <Printer size={20} />
                      </button>
                    </div>

                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold mb-4">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold">{selectedStudent.name}</h2>
                    <p className="text-[#868E96] mb-6 text-sm sm:text-base">{selectedStudent.class} • ID: {selectedStudent.id}</p>
                    
                    <div className="bg-[#F8F9FA] p-4 sm:p-6 rounded-2xl mb-8 print:p-0 print:bg-white">
                      <QRCodeSVG 
                        id="qr-code-svg"
                        value={selectedStudent.id} 
                        size={window.innerWidth < 640 ? 150 : 200} 
                        level="H" 
                        includeMargin 
                      />
                      <p className="mt-4 text-xs sm:text-sm font-medium text-indigo-600 print:hidden">Scan QR ini untuk Absensi</p>
                    </div>

                    <div className="grid grid-cols-4 gap-2 sm:gap-4 w-full print:hidden">
                      {[
                        { label: 'Hadir', val: selectedStudent.hadir, color: 'text-emerald-600' },
                        { label: 'Sakit', val: selectedStudent.sakit, color: 'text-amber-600' },
                        { label: 'Izin', val: selectedStudent.izin, color: 'text-blue-600' },
                        { label: 'Alpa', val: selectedStudent.alpa, color: 'text-rose-600' },
                      ].map((s, i) => (
                        <div key={i} className="text-center">
                          <p className={cn("text-xl sm:text-2xl font-bold", s.color)}>{s.val}</p>
                          <p className="text-[8px] sm:text-[10px] uppercase tracking-widest font-bold text-[#ADB5BD]">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#E9ECEF] overflow-hidden shadow-sm print:hidden">
                    <div className="p-4 border-b border-[#E9ECEF] bg-[#F8F9FA]">
                      <h3 className="font-bold flex items-center gap-2">
                        <Clock size={18} className="text-indigo-600" />
                        Riwayat Kehadiran
                      </h3>
                    </div>
                    <div className="divide-y divide-[#E9ECEF]">
                      {studentAttendance.length > 0 ? (
                        studentAttendance.map((record) => (
                          <div key={record.id} className="p-4 flex justify-between items-center">
                            <div>
                              <p className="font-medium">{format(new Date(record.date), 'EEEE, d MMMM yyyy', { locale: id })}</p>
                              <p className="text-xs text-[#868E96]">{format(new Date(record.timestamp), 'HH:mm:ss')}</p>
                            </div>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold",
                              record.status === 'Hadir' ? "bg-emerald-50 text-emerald-700" :
                              record.status === 'Sakit' ? "bg-amber-50 text-amber-700" :
                              record.status === 'Izin' ? "bg-blue-50 text-blue-700" :
                              "bg-rose-50 text-rose-700"
                            )}>
                              {record.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-[#868E96]">Belum ada riwayat kehadiran.</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'scan' && isAdminAuthenticated && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white p-6 rounded-3xl border border-[#E9ECEF] shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Camera className="text-indigo-600" />
                    Scan QR Absensi
                  </h2>
                  <button 
                    onClick={() => {
                      if (scannerRef.current) scannerRef.current.clear();
                      setView('admin');
                    }}
                    className="p-2 hover:bg-[#F8F9FA] rounded-full transition-colors"
                  >
                    <LogOut size={20} className="text-[#868E96]" />
                  </button>
                </div>

                <div id="reader" className="overflow-hidden rounded-2xl border-2 border-dashed border-[#E9ECEF]"></div>
                
                <div className="mt-6 text-center">
                  <p className="text-sm text-[#868E96]">Arahkan kamera ke QR Code siswa untuk mencatat kehadiran secara otomatis.</p>
                </div>

                {scanResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-6 p-4 rounded-2xl flex items-center gap-3",
                      scanResult.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}
                  >
                    {scanResult.success ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                    <p className="font-medium">{scanResult.message}</p>
                    <button 
                      onClick={() => startScanner()}
                      className="ml-auto text-sm font-bold underline"
                    >
                      Scan Lagi
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal Tambah/Edit Siswa */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#E9ECEF] flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-[#ADB5BD] hover:text-[#1A1A1A]">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleAddOrUpdateStudent} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#495057] mb-1.5">ID Siswa (Nomor Induk)</label>
                  <input 
                    name="id"
                    type="text" 
                    required
                    disabled={!!editingStudent}
                    defaultValue={editingStudent?.id}
                    placeholder="Contoh: 2024001"
                    className="w-full px-4 py-2.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#495057] mb-1.5">Nama Lengkap</label>
                  <input 
                    name="name"
                    type="text" 
                    required
                    defaultValue={editingStudent?.name}
                    placeholder="Masukkan nama lengkap siswa"
                    className="w-full px-4 py-2.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#495057] mb-1.5">Kelas</label>
                  <input 
                    name="class"
                    type="text" 
                    required
                    defaultValue={editingStudent?.class}
                    placeholder="Contoh: 10 IPA 1"
                    className="w-full px-4 py-2.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#495057] mb-1.5">Password Akun</label>
                  <input 
                    name="password"
                    type="text" 
                    required={!editingStudent}
                    placeholder={editingStudent ? "Biarkan kosong jika tidak ingin diubah" : "Masukkan password akun"}
                    className="w-full px-4 py-2.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingStudent ? 'Simpan Perubahan' : 'Daftarkan Siswa'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
