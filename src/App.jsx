import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Filter, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle,
  Search,
  Users,
  BarChart3,
  RefreshCw,
  Download,
  Check,
  PieChart as PieIcon,
  Clock,
  Hourglass,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

// --- INTEGRACIÓN DEL LOGO ---
const logoPath = "/src/assets/Alcazar.png";

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';

const getEnv = (key, fallback = '') => {
  try {
    const value = import.meta.env[key];
    return value || fallback;
  } catch (e) {
    return fallback;
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5;

let firebaseApp, auth, db;
if (isConfigValid) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  } catch (error) {
    console.error("Error inicializando Firebase:", error);
  }
}

const appId = getEnv('VITE_APP_ID', 'residencial-docs-v1');

const STAGES = [1, 2, 3, 4];
const DOC_STATUS = { PENDIENTE: 'Pendiente', REVISION: 'Revisión', OK: 'OK' };
const INITIAL_HOUSES_COUNT = 114;

const getStageForHouse = (num) => {
  if (num >= 1 && num <= 34) return 1;
  if (num >= 35 && num <= 62) return 2;
  if (num >= 63 && num <= 88) return 3;
  if (num >= 89 && num <= 114) return 4;
  return 1;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(isConfigValid);
  const [activeTab, setActiveTab] = useState('control');
  const [errorMessage, setErrorMessage] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [filterStage, setFilterStage] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [formHouse, setFormHouse] = useState({
    id: '', numero: '', etapa: 1, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente'
  });

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ show: false, message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  useEffect(() => {
    if (!isConfigValid || !auth) {
      setErrorMessage("CONFIG_MISSING");
      return;
    }
    const login = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        setErrorMessage("AUTH_ERROR");
      }
    };
    login();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const housesCol = collection(db, 'artifacts', appId, 'public', 'data', 'houses');
    const q = query(housesCol);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        seedDatabase();
      } else {
        const housesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHouses(housesData.sort((a, b) => a.numero - b.numero));
        setLoading(false);
      }
    }, (err) => {
      setErrorMessage("DB_ERROR");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const seedDatabase = async () => {
    if (!db) return;
    setLoading(true);
    const batch = writeBatch(db);
    for (let i = 1; i <= INITIAL_HOUSES_COUNT; i++) {
      const etapa = getStageForHouse(i);
      const houseRef = doc(db, 'artifacts', appId, 'public', 'data', 'houses', `casa-${i}`);
      batch.set(houseRef, {
        numero: i, etapa, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente', updatedAt: Date.now()
      });
    }
    await batch.commit();
  };

  const handleUpdateHouse = async (e) => {
    e.preventDefault();
    if (!formHouse.id || !db) return;
    try {
      const houseRef = doc(db, 'artifacts', appId, 'public', 'data', 'houses', formHouse.id);
      await setDoc(houseRef, { ...formHouse, updatedAt: Date.now() }, { merge: true });
      setToast({ show: true, message: `Casa #${formHouse.numero} actualizada.` });
      setFormHouse({ id: '', numero: '', etapa: 1, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente' });
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (err) { 
      setToast({ show: true, message: 'Error al actualizar.' });
    }
  };

  const exportToCSV = () => {
    const headers = ["Casa", "Etapa", "Fachada", "Predial", "Gravamen", "Estado Final"];
    const rows = houses.map(h => [
      h.numero,
      h.etapa,
      h.doc_fachada,
      h.doc_predial,
      h.doc_gravamen,
      (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Residencial.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHouses = useMemo(() => {
    return houses.filter(h => {
      const stageMatch = filterStage === 'Todas' || h.etapa.toString() === filterStage;
      const hStatus = (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE';
      const statusMatch = filterStatus === 'Todos' || hStatus === filterStatus;
      const searchMatch = h.numero.toString().includes(searchTerm);
      return stageMatch && statusMatch && searchMatch;
    });
  }, [houses, filterStage, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = houses.length || 1;
    const completas = houses.filter(h => (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK')).length;
    const avance = ((completas / total) * 100).toFixed(1);
    const stageData = [1, 2, 3, 4].map(s => {
      const stageHouses = houses.filter(h => h.etapa === s);
      const totalS = stageHouses.length || 1;
      const comp = stageHouses.filter(h => (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK')).length;
      return { stage: s, comp, total: totalS };
    });
    const docStats = {
      fachada: houses.filter(h => h.doc_fachada !== 'OK').length,
      predial: houses.filter(h => h.doc_predial !== 'OK').length,
      gravamen: houses.filter(h => h.doc_gravamen !== 'OK').length,
    };
    return { total: houses.length, completas, avance, stageData, docStats };
  }, [houses]);

  if (errorMessage === "CONFIG_MISSING") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-center p-6">
        <div className="max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h1 className="text-rose-600 font-semibold text-2xl mb-4">Configuración Requerida</h1>
          <p className="text-slate-500 mb-8 text-sm">Por favor, agrega tus variables <code>VITE_FIREBASE_</code> al archivo .env.</p>
          <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-all">Reintentar</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50">
        <RefreshCw className="animate-spin text-blue-600 mb-4" size={32} />
        <p className="text-slate-400 font-medium tracking-widest text-[10px] uppercase">Sincronizando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-600 font-sans overflow-hidden">
      
      {/* Overlay para móvil cuando el sidebar está abierto */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Notificación Toast */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 w-[90%] max-w-xs">
          <div className="bg-emerald-500 rounded-full p-1 shrink-0"><Check size={14} className="text-white" /></div>
          <span className="text-sm font-medium truncate">{toast.message}</span>
        </div>
      )}

      {/* Sidebar Responsivo */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-xl md:shadow-sm transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-100 flex flex-col items-center relative">
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 text-slate-400 md:hidden"
          >
            <X size={20} />
          </button>
          <div className="w-full max-w-[150px] mb-2 mt-4 md:mt-0">
            <img 
              src={logoPath} 
              alt="Alcázar de Salamanca" 
              className="w-full h-auto object-contain mx-auto"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div className="hidden text-center">
              <h2 className="text-[#444] font-bold text-base tracking-tighter">ALCÁZAR DE</h2>
              <h2 className="text-rose-600 font-bold text-lg tracking-widest -mt-1">SALAMANCA</h2>
            </div>
          </div>
          <p className="text-[#4F67EE] text-[9px] font-bold uppercase tracking-[0.2em] opacity-70 mt-2">Gestión de Medidores</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-thin scrollbar-thumb-slate-100">
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <Filter size={12} /> Filtros
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 ml-1">Etapa</label>
                <div className="relative">
                  <select 
                    value={filterStage} 
                    onChange={e => setFilterStage(e.target.value)} 
                    className="w-full bg-[#F1F5F9] border-none p-2.5 rounded-xl text-sm outline-none focus:ring-2 ring-blue-500/10 transition-all cursor-pointer appearance-none text-slate-700"
                  >
                    <option>Todas</option>
                    {STAGES.map(s => <option key={s} value={s}>Etapa {s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 ml-1">Estado General</label>
                <div className="relative">
                  <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="w-full bg-[#F1F5F9] border-none p-2.5 rounded-xl text-sm outline-none focus:ring-2 ring-blue-500/10 transition-all cursor-pointer appearance-none text-slate-700 font-medium"
                  >
                    <option value="Todos">Todos</option>
                    <option value="COMPLETO">✅ COMPLETO</option>
                    <option value="PENDIENTE">⏳ PENDIENTE</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>

          <form onSubmit={handleUpdateHouse} className="space-y-5 pt-6 border-t border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <PlusCircle size={12} /> Actualizar
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <select 
                  required 
                  value={formHouse.id} 
                  onChange={e => {const h = houses.find(x => x.id === e.target.value); if(h) setFormHouse({...h})}} 
                  className="w-full bg-slate-800 text-white p-3 rounded-xl text-sm font-medium shadow-md outline-none focus:ring-2 ring-blue-500 ring-offset-2 appearance-none"
                >
                  <option value="">Buscar Casa...</option>
                  {houses.map(h => <option key={h.id} value={h.id}>Casa #{h.numero} (Etapa {h.etapa})</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {['fachada', 'predial', 'gravamen'].map((key, idx) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase ml-1">
                    {idx + 1}. {key === 'fachada' ? 'Foto Fachada' : key === 'predial' ? 'Impuesto Predial' : 'Cert. Gravamen'}
                  </label>
                  <div className="relative">
                    <select 
                      value={formHouse[`doc_${key}`]} 
                      onChange={e => setFormHouse({...formHouse, [`doc_${key}`]: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs outline-none focus:ring-2 ring-blue-500/10 appearance-none text-slate-600 font-medium"
                    >
                      {Object.values(DOC_STATUS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              ))}
              
              <button type="submit" disabled={!formHouse.id} className="w-full bg-[#4F67EE] hover:bg-blue-700 disabled:bg-slate-200 text-white py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 mt-2 shadow-blue-100">
                Guardar Cambios
              </button>
            </div>
          </form>

          <div className="pt-6 border-t border-slate-100 mt-auto">
            <button 
              onClick={exportToCSV}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 text-[10px] font-bold uppercase tracking-wider py-3 bg-slate-50 rounded-2xl transition-all"
            >
              <Download size={15} /> Exportar CSV
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-10 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-500 md:hidden hover:bg-slate-50 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <div className="flex gap-4 md:gap-10">
              {['control', 'dashboard'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)} 
                  className={`h-20 px-1 md:px-2 text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'text-[#4F67EE] border-[#4F67EE]' : 'text-slate-300 border-transparent hover:text-slate-600'}`}
                >
                  {tab === 'control' ? 'Registro' : 'Avance'}
                </button>
              ))}
            </div>
          </div>
          <div className="relative hidden sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-11 pr-6 py-2 bg-[#F1F5F9] border-none rounded-full text-[11px] font-medium w-40 md:w-64 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400" 
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[#F8FAFC]">
          {activeTab === 'control' ? (
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden max-w-6xl mx-auto animate-in fade-in duration-500">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-normal uppercase tracking-[0.1em] border-b border-slate-100">
                      <th className="p-4 md:p-6">Etapa</th>
                      <th className="p-4 md:p-6">Casa</th>
                      <th className="p-4 md:p-6">Fachada</th>
                      <th className="p-4 md:p-6">Predial</th>
                      <th className="p-4 md:p-6">Gravamen</th>
                      <th className="p-4 md:p-6 text-center font-medium">Estado Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm font-normal">
                    {filteredHouses.map(h => {
                      const status = (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE';
                      return (
                        <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 md:p-6">
                            <span className="bg-blue-50/60 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-medium uppercase whitespace-nowrap">E{h.etapa}</span>
                          </td>
                          <td className="p-4 md:p-6 font-semibold text-slate-700 text-base md:text-lg tracking-tight">#{h.numero}</td>
                          <td className="p-4 md:p-6"><StatusChip status={h.doc_fachada} /></td>
                          <td className="p-4 md:p-6"><StatusChip status={h.doc_predial} /></td>
                          <td className="p-4 md:p-6"><StatusChip status={h.doc_gravamen} /></td>
                          <td className="p-4 md:p-6 text-center">
                            <StatusChipFinal status={status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredHouses.length === 0 && (
                <div className="p-20 text-center text-slate-400 text-sm italic">No hay resultados.</div>
              )}
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto animate-in fade-in duration-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <KPICard title="Total Casas" value={stats.total} icon={<Users className="text-blue-500" size={24} />} />
                <KPICard title="Expedientes OK" value={stats.completas} icon={<CheckCircle className="text-emerald-500" size={24} />} />
                <KPICard title="Avance Global" value={`${stats.avance}%`} icon={<BarChart3 className="text-purple-500" size={24} />} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-400 text-[11px] uppercase tracking-widest mb-8 flex items-center gap-2">
                    <BarChart3 size={16} /> Progreso por Etapa
                  </h4>
                  <div className="space-y-6 md:space-y-8">
                    {stats.stageData.map(s => (
                      <div key={s.stage} className="space-y-3">
                        <div className="flex justify-between text-[11px] font-medium uppercase">
                          <span className="text-slate-500">Etapa {s.stage}</span>
                          <span className="text-[#4F67EE] font-bold">{s.comp} / {s.total}</span>
                        </div>
                        <div className="h-3 bg-slate-50 rounded-full overflow-hidden flex border border-slate-100">
                          <div 
                            className="h-full bg-[#4F67EE] rounded-full transition-all duration-1000 ease-out shadow-sm" 
                            style={{ width: `${(s.comp/s.total)*100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center">
                  <h4 className="font-bold text-slate-400 text-[11px] uppercase tracking-widest mb-10 self-start">Estatus General</h4>
                  <div className="relative w-40 h-40 md:w-48 md:h-48 mb-8">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="50%" cy="50%" r="40%" stroke="#F8FAFC" strokeWidth="12" fill="transparent" />
                      <circle 
                        cx="50%" cy="50%" r="40%" stroke="#10b981" strokeWidth="12" fill="transparent" 
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * (1 - stats.avance / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tighter">{stats.avance}%</span>
                      <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Global</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 md:gap-10 text-[10px] font-medium uppercase tracking-widest">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> <span className="text-slate-600">Listos</span></div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-100"></div> <span className="text-slate-400">Pendientes</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const StatusChip = ({ status }) => {
  const isOk = status === 'OK';
  const isRevision = status === 'Revisión';
  const base = "px-2.5 md:px-3 py-1 rounded-xl border text-[9px] md:text-[10px] font-medium uppercase tracking-tight flex items-center gap-1.5 w-fit transition-all shadow-sm whitespace-nowrap";
  
  if (isOk) return <span className={`${base} bg-emerald-50/60 text-emerald-700 border-emerald-100`}><CheckCircle size={12} /> {status}</span>;
  if (isRevision) return <span className={`${base} bg-amber-50/60 text-amber-700 border-amber-200`}><Clock size={12} /> {status}</span>;
  return <span className={`${base} bg-rose-50/60 text-rose-700 border-rose-100`}><AlertCircle size={12} /> {status}</span>;
};

const StatusChipFinal = ({ status }) => {
  const isComplete = status === 'COMPLETO';
  const base = "px-4 md:px-5 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2 justify-center mx-auto w-fit shadow-sm transition-all whitespace-nowrap";
  
  if (isComplete) return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100`}>Listo</span>;
  return <span className={`${base} bg-rose-50 text-rose-700 border-rose-100`}>Pendiente</span>;
};

const KPICard = ({ title, value, icon }) => (
  <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 md:gap-6 transition-all hover:translate-y-[-2px] group">
    <div className="bg-[#F8FAFC] p-3 md:p-4 rounded-2xl border border-white shadow-inner group-hover:bg-white transition-colors shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{title}</p>
      <p className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tighter leading-none">{value}</p>
    </div>
  </div>
);

export default App;