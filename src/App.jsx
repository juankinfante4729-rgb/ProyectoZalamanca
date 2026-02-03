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
  Settings,
  RefreshCw,
  Download,
  Check,
  PieChart as PieIcon,
  Clock,
  Hourglass,
  ChevronDown
} from 'lucide-react';
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

/**
 * CONFIGURACIÓN DE SEGURIDAD
 */
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

// --- CONSTANTES ---
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
  
  const [filterStage, setFilterStage] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [formHouse, setFormHouse] = useState({
    id: '', numero: '', etapa: 1, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente'
  });

  // Notificación automática
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ show: false, message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // 1. Conexión
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

  // 2. Datos
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
      setToast({ show: true, message: `Casa #${formHouse.numero} actualizada con éxito.` });
      setFormHouse({ id: '', numero: '', etapa: 1, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente' });
    } catch (err) { 
      setToast({ show: true, message: 'No se pudo actualizar.' });
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
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Residencial_${new Date().toLocaleDateString()}.csv`);
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
    
    const stageData = [
      { stage: 1, total: 34 },
      { stage: 2, total: 28 },
      { stage: 3, total: 26 },
      { stage: 4, total: 26 }
    ].map(s => {
      const stageHouses = houses.filter(h => h.etapa === s.stage);
      const comp = stageHouses.filter(h => (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK')).length;
      return { ...s, comp };
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
      <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-center p-10">
        <div className="max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h1 className="text-rose-600 font-semibold text-2xl mb-4">Configuración Requerida</h1>
          <p className="text-slate-500 mb-8 text-sm">Por favor, agrega tus variables <code>VITE_FIREBASE_</code> al archivo .env y reinicia la aplicación.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-md">Reintentar Carga</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50">
        <RefreshCw className="animate-spin text-blue-600 mb-4" size={32} />
        <p className="text-slate-400 font-medium tracking-widest text-[10px] uppercase">Sincronizando con la nube</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-600 font-sans overflow-hidden selection:bg-blue-100">
      
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-500 rounded-full p-1"><Check size={14} className="text-white" /></div>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
        <div className="p-8 bg-[#4F67EE] text-white">
          <div className="flex items-center gap-3 mb-1">
            <LayoutDashboard size={26} className="text-white" />
            <h1 className="font-bold text-2xl tracking-tight">Control Residencial</h1>
          </div>
          <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-90">Gestión de Medidores</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
          {/* Filters Section */}
          <section className="space-y-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <Filter size={13} className="text-slate-300" /> Filtros de Vista
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 ml-1">Etapa</label>
                <div className="relative">
                  <select 
                    value={filterStage} 
                    onChange={e => setFilterStage(e.target.value)} 
                    className="w-full bg-[#F1F5F9] border-none p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-500/20 transition-all cursor-pointer appearance-none text-slate-700 font-medium"
                  >
                    <option>Todas</option>
                    {STAGES.map(s => <option key={s} value={s}>Etapa {s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 ml-1">Estado General</label>
                <div className="relative">
                  <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="w-full bg-[#F1F5F9] border-none p-3 rounded-xl text-sm outline-none focus:ring-2 ring-blue-500/20 transition-all cursor-pointer appearance-none text-slate-700 font-medium"
                  >
                    <option value="Todos">Todos</option>
                    <option value="COMPLETO">✅ COMPLETO</option>
                    <option value="PENDIENTE">⏳ PENDIENTE</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>

          {/* Update Section */}
          <form onSubmit={handleUpdateHouse} className="space-y-5 pt-8 border-t border-slate-100">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <PlusCircle size={13} className="text-slate-300" /> Actualizar Estado
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="relative">
                  <select 
                    required 
                    value={formHouse.id} 
                    onChange={e => {const h = houses.find(x => x.id === e.target.value); if(h) setFormHouse({...h})}} 
                    className="w-full bg-[#F1F5F9] border-none p-3 rounded-xl text-sm font-semibold outline-none focus:ring-2 ring-blue-500/20 cursor-pointer appearance-none text-slate-700"
                  >
                    <option value="">Buscar Casa...</option>
                    {houses.map(h => <option key={h.id} value={h.id}>Casa #{h.numero} (Etapa {h.etapa})</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {['fachada', 'predial', 'gravamen'].map((key, idx) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">
                    {idx + 1}. {key === 'fachada' ? 'Foto Fachada' : key === 'predial' ? 'Impuesto Predial' : 'Cert. Gravamen'}
                  </label>
                  <div className="relative">
                    <select 
                      value={formHouse[`doc_${key}`]} 
                      onChange={e => setFormHouse({...formHouse, [`doc_${key}`]: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs outline-none focus:ring-2 ring-blue-500/20 cursor-pointer appearance-none font-medium text-slate-600"
                    >
                      {Object.values(DOC_STATUS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              ))}
              
              <button 
                type="submit" 
                disabled={!formHouse.id} 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 mt-2 shadow-blue-200"
              >
                Guardar Cambios
              </button>
            </div>
          </form>

          <div className="pt-6 border-t border-slate-100 mt-auto">
            <button 
              onClick={exportToCSV}
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-blue-600 text-[11px] font-bold uppercase tracking-wider py-4 bg-slate-50 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
            >
              <Download size={15} className="text-slate-400 group-hover:text-blue-500" /> Descargar Reporte CSV
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 shrink-0 z-10">
          <div className="flex gap-10">
            {['control', 'dashboard'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)} 
                className={`h-20 px-2 text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'text-blue-600 border-blue-600' : 'text-slate-300 border-transparent hover:text-slate-600'}`}
              >
                {tab === 'control' ? 'Registro y Control' : 'Dashboard de Avance'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="text" 
              placeholder="Buscar por casa o etapa..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-11 pr-6 py-2.5 bg-[#F1F5F9] border-none rounded-full text-[11px] font-medium w-64 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[#F8FAFC]">
          {activeTab === 'control' ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden max-w-6xl mx-auto animate-in fade-in duration-500">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                    <th className="p-6 font-bold">Etapa</th>
                    <th className="p-6 font-bold">Casa</th>
                    <th className="p-6 font-bold">Fachada Frontal</th>
                    <th className="p-6 font-bold">Impuesto Predial</th>
                    <th className="p-6 font-bold">Cert. Gravamen</th>
                    <th className="p-6 font-bold text-center">Estado Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredHouses.map(h => {
                    const status = (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE';
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-tight">Etapa {h.etapa}</span>
                        </td>
                        <td className="p-6 font-bold text-slate-800 text-xl tracking-tight">#{h.numero}</td>
                        <td className="p-6"><StatusChip status={h.doc_fachada} /></td>
                        <td className="p-6"><StatusChip status={h.doc_predial} /></td>
                        <td className="p-6"><StatusChip status={h.doc_gravamen} /></td>
                        <td className="p-6 text-center">
                          <StatusChipFinal status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredHouses.length === 0 && (
                <div className="p-20 text-center text-slate-400 italic text-sm">No se encontraron casas con los filtros seleccionados.</div>
              )}
            </div>
          ) : (
            <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-700">
              {/* Top KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="Total Casas" value={stats.total} icon={<Users className="text-blue-500" size={24} />} />
                <KPICard title="Expedientes Completos" value={stats.completas} icon={<CheckCircle className="text-emerald-500" size={24} />} />
                <KPICard title="Avance Global" value={`${stats.avance}%`} icon={<BarChart3 className="text-purple-500" size={24} />} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Progress by Stage Card */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-400 text-[11px] uppercase tracking-wider mb-8 flex items-center gap-2">
                    <BarChart3 size={16} className="text-slate-300" /> Avance por Etapa
                  </h4>
                  <div className="space-y-8">
                    {stats.stageData.map(s => (
                      <div key={s.stage} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                          <span className="text-slate-700">Etapa {s.stage}</span>
                          <span className="text-slate-400 font-medium">{s.comp} de {s.total} completas ({((s.comp/s.total)*100).toFixed(0)}%)</span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-100">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${(s.comp/s.total)*100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut Chart Card */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <h4 className="font-bold text-slate-400 text-[11px] uppercase tracking-wider mb-8 self-start flex items-center gap-2">
                    <PieIcon size={16} className="text-slate-300" /> Estatus Global del Conjunto
                  </h4>
                  <div className="relative w-48 h-48 mb-8">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="96" cy="96" r="80" stroke="#F1F5F9" strokeWidth="18" fill="transparent" />
                      <circle 
                        cx="96" cy="96" r="80" stroke="#10b981" strokeWidth="18" fill="transparent" 
                        strokeDasharray={2 * Math.PI * 80}
                        strokeDashoffset={2 * Math.PI * 80 * (1 - stats.completas / stats.total)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-slate-800 tracking-tighter">{stats.avance}%</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Completado</span>
                    </div>
                  </div>
                  <div className="flex gap-8 text-[11px] font-bold uppercase tracking-tight">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-slate-600">{stats.completas} Listos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-100"></div>
                      <span className="text-slate-400">{stats.total - stats.completas} Pendientes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Bottlenecks Card */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-6xl mx-auto">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-10 flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-500" /> Documentos Faltantes (Cuello de Botella)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {[
                    { label: 'Foto Fachada Frontal', val: stats.docStats.fachada, col: 'bg-rose-500' },
                    { label: 'Impuesto Predial', val: stats.docStats.predial, col: 'bg-orange-500' },
                    { label: 'Certificado de Gravamen', val: stats.docStats.gravamen, col: 'bg-amber-500' }
                  ].map(d => (
                    <div key={d.label} className="space-y-3">
                      <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                        <span className="text-slate-500">{d.label}</span>
                        <span className="text-rose-500 font-bold">{d.val} pendientes</span>
                      </div>
                      <div className="h-3 bg-slate-50 rounded-full overflow-hidden shadow-inner flex border border-slate-100">
                        <div className={`h-full ${d.col} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${(d.val/stats.total)*100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-[10px] text-slate-400 italic font-medium uppercase tracking-tighter">Resumen de expedientes que aún no cumplen con el requisito marcado como "OK".</p>
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
  
  const base = "px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1.5 w-fit shadow-sm transition-all";
  
  if (isOk) return (
    <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100`}>
      <CheckCircle size={12} className="shrink-0" /> {status}
    </span>
  );
  
  if (isRevision) return (
    <span className={`${base} bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`}>
      <Clock size={12} className="shrink-0" /> {status}
    </span>
  );
  
  return (
    <span className={`${base} bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100`}>
      <AlertCircle size={12} className="shrink-0" /> {status}
    </span>
  );
};

const StatusChipFinal = ({ status }) => {
  const isComplete = status === 'COMPLETO';
  const base = "px-5 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-tighter border flex items-center gap-2 justify-center mx-auto w-fit transition-all shadow-sm";
  
  if (isComplete) return (
    <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100`}>
      <CheckCircle size={13} /> ✓ Listo
    </span>
  );
  
  return (
    <span className={`${base} bg-rose-50 text-rose-700 border-rose-100`}>
      <Hourglass size={13} /> ⏳ Pendiente
    </span>
  );
};

const KPICard = ({ title, value, icon }) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6 transition-all hover:translate-y-[-4px] hover:shadow-md cursor-default group">
      <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-white shadow-inner group-hover:bg-white transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-4xl font-bold text-slate-800 tracking-tighter leading-none">{value}</p>
      </div>
    </div>
  );
};

export default App;