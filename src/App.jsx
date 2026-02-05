import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Home,
  RotateCcw,
  UserCheck,
  FileText,
  Camera,
  ShieldCheck,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardCheck,
  Map as MapIcon
} from 'lucide-react';

/**
 * CONFIGURACIÓN DE IDENTIDAD
 */
const logo = "/Alcazar.png";

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
  const [adminDocs, setAdminDocs] = useState({
    doc_formulario: 'Pendiente',
    doc_entrada: 'Pendiente',
    doc_ruc: 'Pendiente',
    doc_cedula_admin: 'Pendiente',
    doc_plano: 'Pendiente'
  });
  const [loading, setLoading] = useState(isConfigValid);
  const [activeTab, setActiveTab] = useState('control');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  
  // --- FILTROS ---
  const [filterStage, setFilterStage] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // --- ORDENAMIENTO ---
  const [sortConfig, setSortConfig] = useState({ key: 'numero', direction: 'asc' });

  // --- PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Estados del Formulario
  const [formHouse, setFormHouse] = useState({
    id: '', numero: '', etapa: 1, 
    doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente',
    doc_medidor: 'Pendiente', doc_cedula_prop: 'Pendiente', doc_formulario: 'Pendiente'
  });
  const [houseSearchQuery, setHouseSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const hasActiveFilters = useMemo(() => {
    return filterStage !== 'Todas' || filterStatus !== 'Todos' || searchTerm !== '';
  }, [filterStage, filterStatus, searchTerm]);

  const clearFilters = () => {
    setFilterStage('Todas');
    setFilterStatus('Todos');
    setSearchTerm('');
    setCurrentPage(1);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const login = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error");
      }
    };
    login();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    const housesCol = collection(db, 'artifacts', appId, 'public', 'data', 'houses');
    const qHouses = query(housesCol);
    const unsubHouses = onSnapshot(qHouses, (snapshot) => {
      if (snapshot.empty) {
        seedDatabase();
      } else {
        const housesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHouses(housesData);
        setLoading(false);
      }
    });

    const adminDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'admin', 'global');
    const unsubAdmin = onSnapshot(adminDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setAdminDocs(docSnap.data());
      } else {
        setDoc(adminDocRef, {
            doc_formulario: 'Pendiente',
            doc_entrada: 'Pendiente',
            doc_ruc: 'Pendiente',
            doc_cedula_admin: 'Pendiente',
            doc_plano: 'Pendiente'
        });
      }
    });

    return () => {
        unsubHouses();
        unsubAdmin();
    };
  }, [user]);

  const seedDatabase = async () => {
    if (!db) return;
    setLoading(true);
    const batch = writeBatch(db);
    for (let i = 1; i <= INITIAL_HOUSES_COUNT; i++) {
      const etapa = getStageForHouse(i);
      const houseRef = doc(db, 'artifacts', appId, 'public', 'data', 'houses', `casa-${i}`);
      batch.set(houseRef, {
        numero: i, etapa, 
        doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente',
        doc_medidor: 'Pendiente', doc_cedula_prop: 'Pendiente', doc_formulario: 'Pendiente',
        updatedAt: Date.now()
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
      setToast({ show: true, message: `Casa #${formHouse.numero} actualizada.`, type: 'success' });
      setFormHouse({ 
        id: '', numero: '', etapa: 1, 
        doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente',
        doc_medidor: 'Pendiente', doc_cedula_prop: 'Pendiente', doc_formulario: 'Pendiente'
      });
      setHouseSearchQuery('');
      if (window.innerWidth < 1024) setIsSidebarMobileOpen(false);
    } catch (err) { 
      setToast({ show: true, message: 'Error al guardar.', type: 'error' });
    }
  };

  const handleUpdateAdmin = async (key, val) => {
      if (!db) return;
      try {
          const adminDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'admin', 'global');
          await setDoc(adminDocRef, { [key]: val }, { merge: true });
          setToast({ show: true, message: 'Administración actualizada.', type: 'success' });
      } catch (err) {
          setToast({ show: true, message: 'Error en administración.', type: 'error' });
      }
  };

  const processedHouses = useMemo(() => {
    let result = houses.filter(h => {
      const stageMatch = filterStage === 'Todas' || h.etapa.toString() === filterStage.replace('Etapa ', '');
      const isComplete = [h.doc_fachada, h.doc_predial, h.doc_gravamen, h.doc_medidor, h.doc_cedula_prop, h.doc_formulario].every(s => s === 'OK');
      const hStatus = isComplete ? 'COMPLETO' : 'PENDIENTE';
      const statusMatch = filterStatus === 'Todos' || hStatus === filterStatus;
      const searchMatch = h.numero.toString().includes(searchTerm);
      return stageMatch && statusMatch && searchMatch;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (sortConfig.key === 'numero' || sortConfig.key === 'etapa') return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [houses, filterStage, filterStatus, searchTerm, sortConfig]);

  const paginatedHouses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedHouses.slice(startIndex, startIndex + itemsPerPage);
  }, [processedHouses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedHouses.length / itemsPerPage);

  const houseRangeLabel = useMemo(() => {
    if (processedHouses.length === 0) return "";
    const nums = processedHouses.map(h => h.numero).sort((a, b) => a - b);
    const min = nums[0];
    const max = nums[nums.length - 1];
    return `(Casa ${min} a ${max})`;
  }, [processedHouses]);

  const houseOptions = useMemo(() => {
    return houses.filter(h => h.numero.toString().includes(houseSearchQuery));
  }, [houses, houseSearchQuery]);

  const stats = useMemo(() => {
    const source = processedHouses; 
    const totalFiltered = source.length || 0;
    
    const getApprovedCount = (list) => {
      return list.reduce((acc, h) => {
        const count = [
            h.doc_fachada, h.doc_predial, h.doc_gravamen,
            h.doc_medidor, h.doc_cedula_prop, h.doc_formulario
        ].filter(s => s === 'OK').length;
        return acc + count;
      }, 0);
    };

    const prediosTotalmenteListos = source.filter(h => 
        [h.doc_fachada, h.doc_predial, h.doc_gravamen, h.doc_medidor, h.doc_cedula_prop, h.doc_formulario].every(s => s === 'OK')
    ).length;

    const totalApprovedDocs = getApprovedCount(source);
    const totalExpectedDocs = totalFiltered * 6;
    const globalAvanceIncremental = totalExpectedDocs > 0 ? ((totalApprovedDocs / totalExpectedDocs) * 100).toFixed(1) : 0;
    const pctEfectividadCierre = totalFiltered > 0 ? ((prediosTotalmenteListos / totalFiltered) * 100).toFixed(1) : 0;

    const stageData = [1, 2, 3, 4].map(s => {
      const stageHouses = source.filter(h => h.etapa === s);
      const totalS = stageHouses.length;
      const approvedS = getApprovedCount(stageHouses);
      const expectedS = totalS * 6;
      const pctS = expectedS > 0 ? ((approvedS / expectedS) * 100).toFixed(1) : 0;
      return { stage: s, pct: expectedS > 0 ? ((approvedS / expectedS) * 100).toFixed(1) : 0 };
    });

    const docStats = {
      fachada: source.filter(h => h.doc_fachada !== 'OK').length,
      predial: source.filter(h => h.doc_predial !== 'OK').length,
      gravamen: source.filter(h => h.doc_gravamen !== 'OK').length,
      medidor: source.filter(h => h.doc_medidor !== 'OK').length,
      cedula: source.filter(h => h.doc_cedula_prop !== 'OK').length,
      formulario: source.filter(h => h.doc_formulario !== 'OK').length,
    };
    
    return { total: totalFiltered, prediosTotalmenteListos, globalAvanceIncremental, pctEfectividadCierre, stageData, docStats };
  }, [processedHouses]);

  const exportToCSV = () => {
    const headers = ["Casa", "Etapa", "Fachada", "Predial", "Gravamen", "Medidor", "Cedula", "Formulario", "Estado Final"];
    const rows = processedHouses.map(h => [
      h.numero, h.etapa, h.doc_fachada, h.doc_predial, h.doc_gravamen, h.doc_medidor, h.doc_cedula_prop, h.doc_formulario,
      ([h.doc_fachada, h.doc_predial, h.doc_gravamen, h.doc_medidor, h.doc_cedula_prop, h.doc_formulario].every(s => s === 'OK')) ? 'COMPLETO' : 'PENDIENTE'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Alcazar_Reporte_Filtro.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-600 font-sans overflow-hidden">
      
      {/* SIDEBAR RETRÁCTIL */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col shrink-0 
        transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none
        ${isSidebarMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
        ${!isSidebarMobileOpen && !isSidebarCollapsed ? 'lg:w-72' : 'lg:w-16'}
      `}>
        <div className="p-4 border-b border-slate-100 flex flex-col items-center relative bg-white h-24 justify-center">
          <button onClick={() => setIsSidebarMobileOpen(false)} className="absolute top-2 right-2 text-slate-300 lg:hidden hover:text-slate-600 transition-colors"><X size={20} /></button>
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-10 z-50 bg-white border border-slate-200 rounded-full p-1 text-[#4F67EE] shadow-sm hover:bg-blue-50 hidden lg:block transition-transform hover:scale-110"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {!isSidebarCollapsed ? (
            <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center text-center">
              <img src={logo} alt="Alcázar" className="w-full max-w-[130px] h-auto object-contain" />
              <p className="text-[#4F67EE] text-[8px] font-medium uppercase tracking-[0.2em] opacity-70 mt-2">Gestión Documental</p>
            </div>
          ) : (
            <div className="text-[#4F67EE] animate-in fade-in duration-300"><ShieldCheck size={24} /></div>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100 ${isSidebarCollapsed ? 'p-2 space-y-8' : 'p-5 space-y-6'}`}>
          <section className="space-y-4">
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2"><Filter size={12} className="text-[#4F67EE]" /> Filtros</h3>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-[9px] font-medium text-[#4F67EE] uppercase hover:underline"><RotateCcw size={10} /> Reset</button>
                )}
              </div>
            )}
            <div className="space-y-3">
              <FilterSelect label="Etapa" value={filterStage} onChange={setFilterStage} options={['Todas', ...STAGES.map(s => `Etapa ${s}`)]} collapsed={isSidebarCollapsed} icon={<Building2 size={16} />} />
              <FilterSelect label="Estatus" value={filterStatus} onChange={setFilterStatus} options={['Todos', 'COMPLETO', 'PENDIENTE']} showIcons collapsed={isSidebarCollapsed} icon={<Clock size={16} />} />
            </div>
          </section>

          {!isSidebarCollapsed ? (
            <form onSubmit={handleUpdateHouse} className="space-y-4 pt-6 border-t border-slate-100 animate-in fade-in duration-300">
              <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><PlusCircle size={12} className="text-[#4F67EE]" /> Actualizar Casa</h3>
              <div className="space-y-4">
                <div className="relative" ref={dropdownRef}>
                  <input type="text" placeholder="Número de casa..." value={formHouse.numero ? `Unidad #${formHouse.numero}` : houseSearchQuery} onChange={(e) => { if (formHouse.numero) setFormHouse({ ...formHouse, id: '', numero: '' }); setHouseSearchQuery(e.target.value.replace(/[^0-9]/g, '')); setIsDropdownOpen(true); }} className="w-full bg-blue-50/40 border border-blue-100 text-[#4F67EE] p-2 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 transition-all" />
                  {isDropdownOpen && !formHouse.id && (
                    <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto scrollbar-thin">
                      {houseOptions.map(h => (
                        <div key={h.id} onClick={() => { setFormHouse({ ...h }); setIsDropdownOpen(false); }} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-[11px] flex justify-between items-center border-b border-slate-50 last:border-none group transition-colors"><span className="font-normal text-slate-600 group-hover:text-blue-600">Casa #{h.numero}</span><span className="text-[9px] font-medium text-slate-300">E{h.etapa}</span></div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-slate-500">
                  <GroupLabel text="Documentos Inmueble" />
                  <CompactDocSelect label="Fachada" value={formHouse.doc_fachada} onChange={v => setFormHouse({...formHouse, doc_fachada: v})} />
                  <CompactDocSelect label="Predial" value={formHouse.doc_predial} onChange={v => setFormHouse({...formHouse, doc_predial: v})} />
                  <CompactDocSelect label="Gravamen" value={formHouse.doc_gravamen} onChange={v => setFormHouse({...formHouse, doc_gravamen: v})} />
                  <GroupLabel text="Propietario" />
                  <CompactDocSelect label="Sitio Medidor" value={formHouse.doc_medidor} onChange={v => setFormHouse({...formHouse, doc_medidor: v})} />
                  <CompactDocSelect label="Cédula" value={formHouse.doc_cedula_prop} onChange={v => setFormHouse({...formHouse, doc_cedula_prop: v})} />
                  <CompactDocSelect label="Formulario" value={formHouse.doc_formulario} onChange={v => setFormHouse({...formHouse, doc_formulario: v})} />
                </div>
                <button type="submit" disabled={!formHouse.id} className="w-full bg-[#4F67EE] hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white py-2.5 rounded-xl font-medium text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-[0.98]">Guardar Cambios</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center pt-4 border-t border-slate-100 gap-6 text-[#4F67EE] opacity-40"><PlusCircle size={20} /><Home size={20} /><FileText size={20} /></div>
          )}
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9]">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarMobileOpen(true)} className="p-2 text-slate-400 lg:hidden hover:bg-slate-50 rounded-xl transition-colors"><Menu size={22} /></button>
            <div className="flex gap-2 md:gap-8">
              {['control', 'dashboard'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`h-16 px-1 text-[9px] sm:text-[10px] md:text-[11px] font-medium uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'text-[#4F67EE] border-[#4F67EE]' : 'text-slate-300 border-transparent hover:text-slate-500'}`}>{tab === 'control' ? 'Registro' : 'Dashboard'}</button>
              ))}
            </div>
          </div>
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={13} />
            <input type="text" placeholder="Buscar unidad..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-1.5 bg-[#F1F5F9] border-none rounded-full text-[10px] md:text-[11px] font-normal w-24 sm:w-48 md:w-64 outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 transition-all" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {toast.show && (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] ${toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'} text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 w-[90%] max-w-xs`}>
              <div className={`${toast.type === 'error' ? 'bg-white/20' : 'bg-emerald-500'} rounded-full p-1 shrink-0`}>{toast.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}</div>
              <span className="text-sm font-medium truncate">{toast.message}</span>
            </div>
          )}

          {activeTab === 'control' ? (
            <div className="space-y-4 max-w-full mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] font-medium text-slate-800 uppercase tracking-widest">Unidades: {processedHouses.length} <span className="text-[#4F67EE] ml-1">{houseRangeLabel}</span></p>
                  <button onClick={exportToCSV} className="text-[10px] text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 shadow-sm active:scale-95"><Download size={13} /> Exportar Excel</button>
                </div>
                <div className="flex items-center gap-2"><span className="text-[9px] font-medium text-slate-500 uppercase">Mostrar:</span><select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="bg-white border border-slate-200 text-[10px] font-medium rounded-lg px-2 py-1 outline-none shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">{[10, 25, 50, 114].map(n => <option key={n} value={n}>{n === 114 ? 'Todas' : n}</option>)}</select></div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-800 text-[10px] font-medium uppercase tracking-widest border-b border-slate-100">
                        <SortableHeader label="Etapa" sortKey="etapa" sortConfig={sortConfig} onClick={requestSort} />
                        <SortableHeader label="Unidad" sortKey="numero" sortConfig={sortConfig} onClick={requestSort} />
                        <th className="py-3 px-3 text-center text-slate-500">Fachada</th>
                        <th className="py-3 px-3 text-center text-slate-500">Predial</th>
                        <th className="py-3 px-3 text-center text-slate-500">Gravamen</th>
                        <th className="py-3 px-3 text-center text-slate-500">Medidor</th>
                        <th className="py-3 px-3 text-center text-slate-500">Cédula</th>
                        <th className="py-3 px-3 text-center text-slate-500">Formulario</th>
                        <th className="py-3 px-3 text-center bg-slate-100/50 text-slate-700 font-medium">Estatus Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-normal text-slate-600">
                      {paginatedHouses.map(h => {
                        const isComplete = [h.doc_fachada, h.doc_predial, h.doc_gravamen, h.doc_medidor, h.doc_cedula_prop, h.doc_formulario].every(s => s === 'OK');
                        return (
                          <tr key={h.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-medium">Etapa {h.etapa}</td>
                            <td className="py-2 px-3 font-medium text-slate-700 transition-all"><div className="flex items-center gap-2"><div className="p-1 bg-blue-50/50 rounded-md text-[#4F67EE] border border-blue-100/30 group-hover:bg-[#4F67EE] group-hover:text-white transition-all"><Home size={12} /></div><span>#{h.numero}</span></div></td>
                            <td className="py-2 px-3 text-center"><StatusBadge status={h.doc_fachada} /></td>
                            <td className="py-2 px-3 text-center"><StatusBadge status={h.doc_predial} /></td>
                            <td className="py-2 px-3 text-center"><StatusBadge status={h.doc_gravamen} /></td>
                            <td className="py-2 px-3 text-center"><StatusBadge status={h.doc_medidor} /></td>
                            <td className="py-2 px-3 text-center"><StatusBadge status={h.doc_cedula_prop} /></td>
                            <td className="py-2 px-3 text-center"><StatusBadge status={h.doc_formulario} /></td>
                            <td className="py-2 px-3 text-center bg-slate-50/40 transition-all font-medium"><StatusChipFinal status={isComplete ? 'COMPLETO' : 'PENDIENTE'} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {totalPages > 1 && (<div className="flex justify-center items-center gap-4 py-4"><button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 disabled:opacity-20 shadow-sm hover:border-[#4F67EE] hover:text-[#4F67EE] transition-colors"><ChevronLeft size={16} /></button><span className="text-[10px] font-bold text-slate-800 uppercase tracking-tighter">Página {currentPage} de {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 disabled:opacity-20 shadow-sm hover:border-[#4F67EE] hover:text-[#4F67EE] transition-colors"><ChevronRight size={16} /></button></div>)}
            </div>
          ) : (
            <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
              {/* TOP CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <KPICard title="Unidades en Filtro" value={stats.total} icon={<Users className="text-blue-500" size={24} />} bg="bg-white" />
                <KPICard title="Expedientes OK (6/6)" value={stats.prediosTotalmenteListos} icon={<ClipboardCheck className="text-emerald-500" size={24} />} bg="bg-white" />
                
                {/* INDICADOR RESALTADO: EFECTIVIDAD DE CIERRE */}
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-md flex items-center gap-5 transition-all hover:shadow-lg">
                    <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-inner text-emerald-600 transition-all shrink-0"><CheckCircle size={28} /></div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-medium text-emerald-800/60 uppercase tracking-widest mb-1 truncate">Efectividad de Cierre</p>
                        <p className="text-3xl font-medium text-emerald-900 tracking-tighter leading-none">{stats.pctEfectividadCierre}%</p>
                        <p className="text-[9px] text-emerald-600 mt-2 font-normal italic">Carpetas al 100% OK</p>
                    </div>
                </div>
              </div>
              
              {/* ADMIN SECTION REDESIGN */}
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  <h4 className="font-medium text-white/90 text-[11px] uppercase tracking-[0.2em] mb-10 flex items-center gap-3">
                    <ShieldCheck size={20} className="text-blue-400" /> Administración Global del Conjunto
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <AdminCard icon={<FileText size={18} />} label="Formulario Conjunto" status={adminDocs.doc_formulario} onUpdate={(v) => handleUpdateAdmin('doc_formulario', v)} />
                      <AdminCard icon={<Camera size={18} />} label="Foto Entrada" status={adminDocs.doc_entrada} onUpdate={(v) => handleUpdateAdmin('doc_entrada', v)} />
                      <AdminCard icon={<Building2 size={18} />} label="RUC del Conjunto" status={adminDocs.doc_ruc} onUpdate={(v) => handleUpdateAdmin('doc_ruc', v)} />
                      <AdminCard icon={<UserCheck size={18} />} label="Cédula Administrador" status={adminDocs.doc_cedula_admin} onUpdate={(v) => handleUpdateAdmin('doc_cedula_admin', v)} />
                      <AdminCard icon={<MapIcon size={18} />} label="Plano Implantación" status={adminDocs.doc_plano || 'Pendiente'} onUpdate={(v) => handleUpdateAdmin('doc_plano', v)} />
                  </div>
              </div>

              {/* PROGRESS SECTION REDESIGN */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* RENDIMIENTO POR ETAPA CON FONDO OSCURO */}
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <h4 className="font-medium text-slate-800 text-[11px] uppercase tracking-widest mb-10 flex items-center gap-2 border-b border-slate-200 pb-4"><BarChart3 size={16} className="text-blue-500" /> Rendimiento por Etapa</h4>
                  <div className="space-y-8">
                    {stats.stageData.map(s => (
                      <div key={s.stage} className="space-y-3 group">
                        <div className="flex justify-between items-end"><span className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Etapa {s.stage}</span><span className="text-slate-800 font-medium text-xs">{s.pct}% <span className="text-slate-400 font-normal ml-1 text-[10px]">Docs OK</span></span></div>
                        <div className="h-2 bg-white rounded-full overflow-hidden flex border border-slate-200 group-hover:border-blue-300 transition-colors shadow-inner"><div className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${s.pct}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GLOBAL DONUT CON FONDO AZUL */}
                <div className="bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md group">
                  <h4 className="font-medium text-blue-900 text-[11px] uppercase tracking-widest mb-10 self-start border-b border-blue-200 pb-4 w-full text-center">Avance de Carga Documental</h4>
                  <div className="relative w-48 h-48 mb-8 transition-transform group-hover:scale-105 duration-300">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="50%" cy="50%" r="42%" stroke="rgba(255,255,255,1)" strokeWidth="18" fill="transparent" />
                      <circle cx="50%" cy="50%" r="42%" stroke="#10b981" strokeWidth="18" fill="transparent" strokeDasharray="264" strokeDashoffset={264 * (1 - stats.globalAvanceIncremental / 100)} strokeLinecap="round" className="transition-all duration-1000 ease-in-out shadow-sm" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-4xl font-medium text-slate-800 tracking-tighter leading-none">{stats.globalAvanceIncremental}%</span><span className="text-[10px] font-medium text-slate-400 uppercase mt-2 tracking-widest">Documentos OK</span></div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-8 text-[10px] font-medium uppercase tracking-widest text-slate-400 transition-all">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div> Logrados</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white border border-blue-200"></div> Faltantes</div>
                  </div>
                </div>
              </div>

              {/* BOTTLENECKS REDESIGN */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <h4 className="font-medium text-slate-800 text-[11px] uppercase tracking-widest mb-12 flex items-center gap-2 border-b border-slate-100 pb-4"><AlertCircle size={18} className="text-rose-500" /> Documentación en curso</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-12">
                  <DocMetric label="Fachada" count={stats.docStats.fachada} total={stats.total} color="bg-rose-100" textColor="text-rose-700" icon={<Camera size={14} className="text-rose-400" />} />
                  <DocMetric label="Imp. Predial" count={stats.docStats.predial} total={stats.total} color="bg-orange-100" textColor="text-orange-700" icon={<Building2 size={14} className="text-orange-400" />} />
                  <DocMetric label="Cert. Gravamen" count={stats.docStats.gravamen} total={stats.total} color="bg-amber-100" textColor="text-amber-700" icon={<ShieldCheck size={14} className="text-amber-400" />} />
                  <DocMetric label="Sitio Medidor" count={stats.docStats.medidor} total={stats.total} color="bg-blue-100" textColor="text-blue-700" icon={<Camera size={14} className="text-blue-400" />} />
                  <DocMetric label="Cédula Prop." count={stats.docStats.cedula} total={stats.total} color="bg-indigo-100" textColor="text-indigo-700" icon={<UserCheck size={14} className="text-indigo-400" />} />
                  <DocMetric label="Formulario" count={stats.docStats.formulario} total={stats.total} color="bg-purple-100" textColor="text-purple-700" icon={<FileText size={14} className="text-purple-400" />} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// --- COMPONENTES ATÓMICOS ---
const GroupLabel = ({ text }) => <p className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.15em] pt-3 pb-1 border-b border-slate-50 mb-2">{text}</p>;

const CompactDocSelect = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between gap-3 p-1 hover:bg-slate-50 rounded-lg transition-colors group">
        <label className="text-[10px] font-medium text-slate-700 truncate group-hover:text-slate-900">{label}</label>
        <div className="relative w-28">
            <select value={value} onChange={e => onChange(e.target.value)} className={`w-full border-none p-1 pr-6 rounded-md text-[10px] font-medium appearance-none outline-none focus:ring-1 ring-blue-500/20 cursor-pointer transition-all ${value === 'OK' ? 'bg-emerald-50 text-emerald-700' : value === 'Revisión' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{Object.values(DOC_STATUS).map(s => <option key={s} value={s}>{s}</option>)}</select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
        </div>
    </div>
);

const AdminCard = ({ icon, label, status, onUpdate }) => (
    <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col gap-4 group transition-all hover:bg-slate-700 hover:scale-[1.02]">
        <div className="flex items-center gap-3"><div className="p-2 bg-slate-900 rounded-xl text-blue-400 shadow-sm group-hover:bg-slate-800 transition-all">{icon}</div><p className="text-[9px] font-medium text-slate-300 leading-tight tracking-tighter uppercase">{label}</p></div>
        <div className="relative">
            <select value={status} onChange={e => onUpdate(e.target.value)} className={`w-full p-2 rounded-xl text-[10px] font-normal appearance-none outline-none border transition-all cursor-pointer ${status === 'OK' ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm' : status === 'Revisión' ? 'bg-amber-400 text-slate-900 border-amber-300' : 'bg-slate-900 text-slate-400 border-slate-600 hover:border-slate-500'}`}>{Object.values(DOC_STATUS).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select>
            <ChevronDown size={12} className={`absolute right-3 top-1/2 -translate-y-1/2 ${status === 'OK' || status === 'Revisión' ? 'text-slate-900' : 'text-slate-500'}`} />
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
  const base = "px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-tight flex items-center justify-center gap-1.5 w-full max-w-[90px] mx-auto shadow-sm transition-all";
  if (status === 'OK') return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none`}><CheckCircle size={10} /> OK</span>;
  if (status === 'Revisión') return <span className={`${base} bg-amber-50 text-amber-700 border-amber-100 shadow-none`}><Clock size={10} /> REV.</span>;
  return <span className={`${base} bg-rose-50 text-rose-700 border-rose-100 shadow-none`}><AlertCircle size={10} /> PEND.</span>;
};

const SortableHeader = ({ label, sortKey, sortConfig, onClick }) => {
  const isActive = sortConfig.key === sortKey;
  return (
    <th className="py-3 px-3 font-bold cursor-pointer group hover:bg-slate-100 transition-colors select-none text-slate-800" onClick={() => onClick(sortKey)}>
      <div className="flex items-center gap-2">{label}<div className="text-slate-400 group-hover:text-slate-600 transition-all">{!isActive ? <ArrowUpDown size={11} /> : sortConfig.direction === 'asc' ? <ArrowUp size={11} className="text-[#4F67EE]" /> : <ArrowDown size={11} className="text-[#4F67EE]" />}</div></div>
    </th>
  );
};

const FilterSelect = ({ label, value, onChange, options, showIcons, collapsed, icon }) => (
  <div className={`space-y-1.5 ${collapsed ? 'flex justify-center' : ''}`}>
    {!collapsed ? (
        <><label className="text-[10px] font-medium text-slate-800 ml-1 uppercase tracking-tighter">{label}</label><div className="relative"><select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-[#F1F5F9] border-none p-2 rounded-xl text-[11px] outline-none focus:ring-2 ring-blue-500/10 transition-all cursor-pointer appearance-none text-slate-900 font-medium transition-colors">{options.map(opt => (<option key={opt} value={opt}>{opt.includes('Ver') ? opt : opt === 'Todas' || opt === 'Todos' ? `Ver ${opt}` : opt}</option>))}</select><ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div></>
    ) : (
        <div className={`p-2 rounded-xl transition-colors cursor-pointer ${value !== 'Todas' && value !== 'Todos' ? 'bg-blue-50 text-[#4F67EE]' : 'text-slate-300 hover:text-[#4F67EE]'}`} title={`${label}: ${value}`}>{icon}</div>
    )}
  </div>
);

const StatusChipFinal = ({ status }) => {
  const isComplete = status === 'COMPLETO';
  const base = "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border flex items-center gap-2 justify-center mx-auto w-fit shadow-sm transition-all";
  if (isComplete) return <span className={`${base} bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-100`}><Check size={12} /> Listo</span>;
  return <span className={`${base} bg-rose-100 text-rose-800 border-rose-200 shadow-none transition-all`}><Hourglass size={12} /> Pendiente</span>;
};

const KPICard = ({ title, value, icon, bg }) => (
  <div className={`${bg} p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-6 group transition-all hover:translate-y-[-2px] hover:shadow-md`}>
    <div className="bg-slate-50 p-4 rounded-2xl border border-white shadow-inner group-hover:bg-[#4F67EE]/10 group-hover:text-[#4F67EE] transition-all shrink-0">{icon}</div>
    <div className="min-w-0"><p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] mb-1 truncate">{title}</p><p className="text-3xl font-medium text-slate-800 tracking-tighter leading-none">{value}</p></div>
  </div>
);

const DocMetric = ({ label, count, total, color, textColor, icon }) => {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
  return (
    <div className="space-y-4 group cursor-default transition-all">
      <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2 transition-all group-hover:translate-x-0.5">
                <div className={`p-2 rounded-xl ${color} text-slate-600 shadow-sm`}>{icon}</div>
                <p className="text-[10px] font-medium text-slate-800 uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-3xl font-medium text-slate-900 tracking-tighter leading-none">{count} <span className="text-xs font-medium text-slate-400 uppercase ml-1 tracking-tighter">faltan</span></p>
          </div>
          <span className={`text-[12px] font-medium ${textColor} group-hover:scale-110 transition-transform`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
        <div className={`${color.replace('100', '500')} h-full transition-all duration-1000 ease-in-out shadow-sm`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

export default App;