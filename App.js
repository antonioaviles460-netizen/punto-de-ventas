import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  updateDoc, doc, deleteDoc 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged 
} from "firebase/auth";
import './App.css';

// Configuración de Firebase usando variables de entorno (deben estar en Vercel)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ==================== Hooks personalizados ====================
const useProductos = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snap) => {
      const prods = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre || "Sin nombre",
          stock: Number(data.stock) || 0,
          precio: Number(data.precio) || 0,
          precioCredito: Number(data.precioCredito) || Number(data.precio) || 0,
          costo: Number(data.costo) || 0,
          barras: data.barras || ""
        };
      });
      setProductos(prods);
      setLoading(false);
    }, (err) => {
      console.error("Error al cargar productos:", err);
      setError(err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { productos, loading, error };
};

const useVentas = () => {
  const [ventas, setVentas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error al cargar ventas:", err);
      setError(err.message);
    });
    return () => unsub();
  }, []);

  return { ventas, error };
};

const useCuentasPorCobrar = () => {
  const [cuentas, setCuentas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cuentasPorCobrar"), (snap) => {
      setCuentas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error al cargar cuentas:", err);
      setError(err.message);
    });
    return () => unsub();
  }, []);

  return { cuentas, error };
};

// ==================== Componente Toast ====================
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      {message}
    </div>
  );
};

// ==================== App principal ====================
const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [mesReporte, setMesReporte] = useState(new Date().toISOString().substring(0, 7));
  const [nuevoProd, setNuevoProd] = useState({ 
    nombre: '', 
    stock: '', 
    precio: '', 
    precioCredito: '', 
    costo: '', 
    barras: '' 
  });
  const [notification, setNotification] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Estado para el detalle de cliente en Por Cobrar
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [mostrarModalAbono, setMostrarModalAbono] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '' });
  const [mostrarFormNuevoCliente, setMostrarFormNuevoCliente] = useState(false);

  // Datos de Firebase
  const { productos, loading: productosLoading, error: productosError } = useProductos();
  const { ventas, error: ventasError } = useVentas();
  const { cuentas: cuentasPorCobrar, error: cuentasError } = useCuentasPorCobrar();

  // Lista de socios (reemplaza los UIDs con los reales)
  const partners = [
    { uid: 'admin-uid-real', name: 'Antonio (Admin)', equity: 60, role: 'admin' },
    { uid: 'emir-uid-real', name: 'Emir', equity: 20, role: 'socio' },
    { uid: 'robert-uid-real', name: 'Robert', equity: 20, role: 'socio' },
  ];

  // Escuchar cambios en la autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idTokenResult = await firebaseUser.getIdTokenResult();
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email,
          role: idTokenResult.claims.role || 'socio',
          equity: idTokenResult.claims.equity || 0
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
  };

  // ========== Funciones de autenticación ==========
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      showNotification('Sesión iniciada correctamente');
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showNotification('Sesión iniciada con Google');
    } catch (error) {
      showNotification('Error con Google: ' + error.message, 'error');
    }
  };

  const handleRegister = async () => {
    const email = prompt('Correo electrónico para registrarse:');
    const password = prompt('Contraseña (mínimo 6 caracteres):');
    if (!email || !password) return;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      showNotification('Usuario registrado. Ahora inicia sesión.');
    } catch (error) {
      showNotification('Error al registrar: ' + error.message, 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    showNotification('Sesión cerrada');
  };

  // ========== Cálculos memorizados ==========
  const productoEscaneado = useMemo(() => {
    return productos.find(p => p.barras === searchTerm && searchTerm !== "");
  }, [productos, searchTerm]);

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.barras.includes(searchTerm)
    );
  }, [productos, searchTerm]);

  const inversionStock = useMemo(() => {
    return productos.reduce((acc, p) => acc + (p.costo * p.stock), 0);
  }, [productos]);

  // Ventas del mes para reportes
  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => v.fecha && v.fecha.startsWith(mesReporte));
  }, [ventas, mesReporte]);

  const gananciaMes = useMemo(() => {
    return ventasFiltradas.reduce((acc, v) => acc + (v.ganancia || 0), 0);
  }, [ventasFiltradas]);

  const totalVentasMes = useMemo(() => {
    return ventasFiltradas.reduce((acc, v) => acc + (v.total || 0), 0);
  }, [ventasFiltradas]);

  // Actividad reciente (combinar ventas y créditos)
  const actividadReciente = useMemo(() => {
    const ventasConTipo = ventas.map(v => ({ ...v, tipo: 'venta', idUnico: `venta-${v.id}` }));
    const creditosConTipo = cuentasPorCobrar.map(c => ({ ...c, tipo: 'credito', idUnico: `credito-${c.id}` }));
    const todos = [...ventasConTipo, ...creditosConTipo];
    return todos
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);
  }, [ventas, cuentasPorCobrar]);

  // Resumen del día actual
  const hoy = new Date().toISOString().split('T')[0];
  const ventasHoy = useMemo(() => {
    return ventas.filter(v => v.fecha && v.fecha.startsWith(hoy));
  }, [ventas, hoy]);
  const creditosHoy = useMemo(() => {
    return cuentasPorCobrar.filter(c => c.fecha && c.fecha.startsWith(hoy));
  }, [cuentasPorCobrar, hoy]);
  const totalVentasHoy = ventasHoy.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalCreditosHoy = creditosHoy.reduce((acc, c) => acc + (c.total || 0), 0);

  // Productos más vendidos
  const productosMasVendidos = useMemo(() => {
    const todasLasVentas = [
      ...ventas.map(v => ({ producto: v.producto, total: v.total })),
      ...cuentasPorCobrar.map(c => ({ producto: c.producto, total: c.total }))
    ];
    const conteo = {};
    todasLasVentas.forEach(item => {
      if (!conteo[item.producto]) {
        conteo[item.producto] = { cantidad: 0, total: 0 };
      }
      conteo[item.producto].cantidad += 1;
      conteo[item.producto].total += item.total;
    });
    const array = Object.entries(conteo).map(([nombre, datos]) => ({
      nombre,
      cantidad: datos.cantidad,
      total: datos.total
    }));
    return array.sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  }, [ventas, cuentasPorCobrar]);

  // ========== Funciones CRUD ==========
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (user?.role !== 'admin') {
      showNotification('Solo administradores pueden agregar productos', 'error');
      return;
    }
    if (!nuevoProd.nombre || !nuevoProd.precio) {
      showNotification('Nombre y precio de contado son obligatorios', 'error');
      return;
    }
    const precioCredito = parseFloat(nuevoProd.precioCredito) || parseFloat(nuevoProd.precio) || 0;
    try {
      await addDoc(collection(db, "productos"), {
        nombre: nuevoProd.nombre,
        stock: parseInt(nuevoProd.stock) || 0,
        precio: parseFloat(nuevoProd.precio) || 0,
        precioCredito: precioCredito,
        costo: parseFloat(nuevoProd.costo) || 0,
        barras: nuevoProd.barras,
        fecha: new Date().toISOString()
      });
      setNuevoProd({ nombre: '', stock: '', precio: '', precioCredito: '', costo: '', barras: '' });
      showNotification('Producto guardado');
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    }
  };

  const ajustarStock = async (p, cantidad) => {
    const nuevoStock = (p.stock || 0) + cantidad;
    if (nuevoStock < 0) {
      showNotification('Stock insuficiente', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, "productos", p.id), { stock: nuevoStock });
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    }
  };

  const eliminarProducto = async (id, nombre) => {
    if (user?.role !== 'admin') {
      showNotification('Solo administradores pueden eliminar', 'error');
      return;
    }
    if (window.confirm(`¿Eliminar "${nombre}"?`)) {
      try {
        await deleteDoc(doc(db, "productos", id));
        showNotification('Producto eliminado');
      } catch (err) {
        showNotification('Error: ' + err.message, 'error');
      }
    }
  };

  const registrarTransaccion = async (prod, esCredito = false) => {
    if (prod.stock <= 0) {
      showNotification('¡Sin stock!', 'error');
      return;
    }

    let clienteNombre = "General";
    let clienteTelefono = "";
    const montoVenta = esCredito ? prod.precioCredito : prod.precio;

    if (esCredito) {
      clienteNombre = prompt("Nombre del cliente:").toUpperCase().trim();
      if (!clienteNombre) return;
      clienteTelefono = prompt("Teléfono del cliente (opcional):").trim();
      
      const deudaActual = cuentasPorCobrar
        .filter(c => c.clienteNombre === clienteNombre && !c.pagado)
        .reduce((acc, c) => acc + (c.saldo || c.total || 0), 0);
      
      const limite = parseFloat(prompt(`Deuda actual: $${deudaActual}. Límite autorizado:`, "500")) || 0;
      if (deudaActual + montoVenta > limite) {
        showNotification('Crédito rechazado: excede el límite', 'error');
        return;
      }
    }

    const datos = {
      producto: prod.nombre,
      total: montoVenta,
      costo: prod.costo,
      ganancia: montoVenta - prod.costo,
      vendedor: user.name,
      vendedorId: user.uid,
      clienteNombre: esCredito ? clienteNombre : "General",
      clienteTelefono: esCredito ? clienteTelefono : "",
      fecha: new Date().toISOString()
    };

    try {
      if (esCredito) {
        await addDoc(collection(db, "cuentasPorCobrar"), { 
          ...datos, 
          pagado: false,
          abonado: 0,
          saldo: montoVenta
        });
      } else {
        await addDoc(collection(db, "ventas"), datos);
      }
      await updateDoc(doc(db, "productos", prod.id), { stock: prod.stock - 1 });
      setSearchTerm('');
      showNotification('Venta registrada');
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    }
  };

  // ========== Funciones para Por Cobrar ==========
  const handleVerCliente = (clienteNombre) => {
    const cuentasCliente = cuentasPorCobrar.filter(c => c.clienteNombre === clienteNombre);
    const totalDeuda = cuentasCliente.reduce((acc, c) => acc + (c.saldo || c.total || 0), 0);
    setClienteSeleccionado({
      nombre: clienteNombre,
      telefono: cuentasCliente[0]?.clienteTelefono || '',
      cuentas: cuentasCliente,
      totalDeuda
    });
  };

  const cerrarDetalleCliente = () => {
    setClienteSeleccionado(null);
  };

  const abrirModalAbono = (cuenta) => {
    setCuentaSeleccionada(cuenta);
    setMontoAbono('');
    setMostrarModalAbono(true);
  };

  const realizarAbono = async () => {
    if (!cuentaSeleccionada) return;
    const monto = parseFloat(montoAbono);
    if (isNaN(monto) || monto <= 0) {
      showNotification('Ingrese un monto válido', 'error');
      return;
    }
    if (monto > (cuentaSeleccionada.saldo || cuentaSeleccionada.total)) {
      showNotification('El abono no puede ser mayor al saldo', 'error');
      return;
    }

    try {
      const nuevoAbonado = (cuentaSeleccionada.abonado || 0) + monto;
      const nuevoSaldo = (cuentaSeleccionada.saldo || cuentaSeleccionada.total) - monto;
      const pagado = nuevoSaldo <= 0;

      await updateDoc(doc(db, "cuentasPorCobrar", cuentaSeleccionada.id), {
        abonado: nuevoAbonado,
        saldo: nuevoSaldo,
        pagado: pagado
      });

      await addDoc(collection(db, "abonos"), {
        cuentaId: cuentaSeleccionada.id,
        monto: monto,
        fecha: new Date().toISOString(),
        realizadoPor: user.name,
        realizadoPorId: user.uid
      });

      showNotification('Abono registrado correctamente');
      setMostrarModalAbono(false);
      setCuentaSeleccionada(null);
      if (clienteSeleccionado) {
        handleVerCliente(clienteSeleccionado.nombre);
      }
    } catch (err) {
      showNotification('Error al registrar abono: ' + err.message, 'error');
    }
  };

  const liquidarCuenta = async (cuenta) => {
    if (!window.confirm(`¿Liquidar la cuenta de $${cuenta.saldo || cuenta.total}?`)) return;
    try {
      await updateDoc(doc(db, "cuentasPorCobrar", cuenta.id), {
        abonado: cuenta.total,
        saldo: 0,
        pagado: true
      });
      await addDoc(collection(db, "abonos"), {
        cuentaId: cuenta.id,
        monto: cuenta.saldo || cuenta.total,
        fecha: new Date().toISOString(),
        realizadoPor: user.name,
        realizadoPorId: user.uid,
        tipo: 'liquidacion'
      });
      showNotification('Cuenta liquidada');
      if (clienteSeleccionado) {
        handleVerCliente(clienteSeleccionado.nombre);
      }
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    }
  };

  // Agrupar cuentas por cliente para la vista principal de Por Cobrar
  const clientesConDeuda = useMemo(() => {
    const mapa = {};
    cuentasPorCobrar.forEach(cuenta => {
      if (!cuenta.clienteNombre || cuenta.clienteNombre === "General") return;
      if (!mapa[cuenta.clienteNombre]) {
        mapa[cuenta.clienteNombre] = {
          nombre: cuenta.clienteNombre,
          telefono: cuenta.clienteTelefono || '',
          totalDeuda: 0,
          cuentas: []
        };
      }
      mapa[cuenta.clienteNombre].totalDeuda += (cuenta.saldo || cuenta.total || 0);
      mapa[cuenta.clienteNombre].cuentas.push(cuenta);
    });
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [cuentasPorCobrar]);

  // Mostrar loading mientras se verifica autenticación
  if (authLoading) {
    return <div className="loading">Cargando aplicación...</div>;
  }

  // Pantalla de login
  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="logo">AR MARKET</div>
          <form onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder="Email" 
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required 
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required 
            />
            <button type="submit">Entrar con Email</button>
          </form>
          <button onClick={handleGoogleLogin} style={{ marginTop: '10px', background: '#4285F4' }}>
            Iniciar sesión con Google
          </button>
          <p style={{ marginTop: '15px' }}>
            ¿No tienes cuenta? <button onClick={handleRegister} style={{ background: 'none', color: '#27ae60', textDecoration: 'underline' }}>Regístrate</button>
          </p>
        </div>
        {notification && <Toast {...notification} onClose={() => setNotification(null)} />}
      </div>
    );
  }

  // App principal
  return (
    <div className="admin-container">
      <nav className="sidebar">
        <div className="logo">AR MARKET</div>
        <div className="user-profile">
          <strong>{user.name}</strong>
          <small style={{ display: 'block', color: '#bdc3c7' }}>Rol: {user.role}</small>
        </div>
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
        <button className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')}>Inventario / Escáner</button>
        <button className={view === 'reportes' ? 'active' : ''} onClick={() => setView('reportes')}>Reportes</button>
        <button className={view === 'cobrar' ? 'active' : ''} onClick={() => setView('cobrar')}>Por Cobrar</button>
        <button className="logout" onClick={handleLogout}>Salir</button>
      </nav>

      <main className="content">
        {/* Banners de error */}
        {(productosError || ventasError || cuentasError) && (
          <div className="error-banner" style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
            <strong>Error de conexión con Firebase:</strong>
            {productosError && <p>Productos: {productosError}</p>}
            {ventasError && <p>Ventas: {ventasError}</p>}
            {cuentasError && <p>Cuentas: {cuentasError}</p>}
          </div>
        )}

        {view === 'dashboard' && (
          <div className="dashboard-view fade-in">
            <h2>Panel Administrativo</h2>
            
            <div className="summary-cards">
              <div className="stat-card">
                <span>Ventas Hoy</span>
                <h3>${totalVentasHoy.toLocaleString()}</h3>
              </div>
              <div className="stat-card">
                <span>Créditos Hoy</span>
                <h3>${totalCreditosHoy.toLocaleString()}</h3>
              </div>
              <div className="stat-card">
                <span>Valor Stock</span>
                <h3>${inversionStock.toLocaleString()}</h3>
              </div>
              <div className="stat-card">
                <span>Ganancia Mes</span>
                <h3 className="profit-text">${gananciaMes.toLocaleString()}</h3>
              </div>
            </div>

            <div className="partner-cards">
              {partners.map(p => (
                <div className="card-partner" key={p.uid}>
                  <div className="card-header">
                    <h4>{p.name}</h4>
                    <span className="badge">{p.equity}%</span>
                    {user.uid === p.uid && <span className="badge" style={{ background: '#f39c12' }}>Tú</span>}
                  </div>
                  <div className="roi-highlight">
                    <p>Ganancia estimada</p>
                    <h2 className="profit-text">${(gananciaMes * (p.equity / 100)).toFixed(2)}</h2>
                  </div>
                </div>
              ))}
            </div>

            <div className="dashboard-grid-2col">
              <div className="recent-activity">
                <h3>Actividad Reciente</h3>
                <div className="activity-list">
                  {actividadReciente.length === 0 ? (
                    <p>No hay movimientos recientes</p>
                  ) : (
                    actividadReciente.map(item => (
                      <div key={item.idUnico} className={`activity-item ${item.tipo}`}>
                        <span className="activity-time">
                          {new Date(item.fecha).toLocaleTimeString()}
                        </span>
                        <span className="activity-type">
                          {item.tipo === 'venta' ? '💰' : '📝'}
                        </span>
                        <span className="activity-desc">
                          <strong>{item.producto}</strong> - ${item.total} 
                          <small> ({item.vendedor})</small>
                          {item.clienteNombre && item.clienteNombre !== 'General' && 
                            <span className="activity-cliente"> - Cliente: {item.clienteNombre}</span>
                          }
                          {item.tipo === 'credito' && !item.pagado && 
                            <span className="badge-pendiente"> Pendiente</span>
                          }
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="top-products">
                <h3>Productos más vendidos</h3>
                <div className="top-products-list">
                  {productosMasVendidos.length === 0 ? (
                    <p>Aún no hay ventas</p>
                  ) : (
                    productosMasVendidos.map((prod, index) => (
                      <div key={prod.nombre} className="top-product-item">
                        <span className="top-product-rank">{index + 1}</span>
                        <span className="top-product-name">{prod.nombre}</span>
                        <span className="top-product-count">{prod.cantidad} ventas</span>
                        <span className="top-product-total">${prod.total.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'inventory' && (
          <div className="inventory-view fade-in">
            <div className="header-flex">
              <h2>Inventario / Escáner</h2>
            </div>

            {user.role === 'admin' && (
              <form className="add-form" onSubmit={handleAddProduct}>
                <input placeholder="Nombre" value={nuevoProd.nombre} onChange={e => setNuevoProd({ ...nuevoProd, nombre: e.target.value })} required />
                <input type="number" placeholder="Stock" value={nuevoProd.stock} onChange={e => setNuevoProd({ ...nuevoProd, stock: e.target.value })} required />
                <input type="number" step="0.01" placeholder="Precio Contado" value={nuevoProd.precio} onChange={e => setNuevoProd({ ...nuevoProd, precio: e.target.value })} required />
                <input type="number" step="0.01" placeholder="Precio Crédito" value={nuevoProd.precioCredito} onChange={e => setNuevoProd({ ...nuevoProd, precioCredito: e.target.value })} />
                <input type="number" step="0.01" placeholder="Costo" value={nuevoProd.costo} onChange={e => setNuevoProd({ ...nuevoProd, costo: e.target.value })} />
                <input placeholder="Código de Barras" value={nuevoProd.barras} onChange={e => setNuevoProd({ ...nuevoProd, barras: e.target.value })} />
                <button type="submit">Guardar</button>
              </form>
            )}

            <div className="search-section">
              <input className="search-input scanner-input" placeholder="Pase el escáner o busque nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
              {productoEscaneado && (
                <div className="scanner-alert">
                  <div className="scanner-info">
                    ✅ <strong>{productoEscaneado.nombre}</strong> - 
                    Contado: ${productoEscaneado.precio} | 
                    Crédito: ${productoEscaneado.precioCredito}
                  </div>
                  <div className="scanner-actions">
                    <button className="sale-btn" onClick={() => registrarTransaccion(productoEscaneado)}>Contado</button>
                    <button className="credit-btn" onClick={() => registrarTransaccion(productoEscaneado, true)}>Crédito</button>
                  </div>
                </div>
              )}
            </div>

            {productosLoading ? (
              <div className="loading">Cargando productos...</div>
            ) : (
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock</th>
                    <th>P. Contado</th>
                    <th>P. Crédito</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map(p => {
                    const esBajoStock = p.stock < 5;
                    const esElEscaneado = p.barras === searchTerm && searchTerm !== "";
                    return (
                      <tr key={p.id} className={esElEscaneado ? 'highlight-row' : ''}>
                        <td className={esBajoStock ? 'low-stock' : ''}>
                          {p.nombre} {esBajoStock && '⚠️'} <br />
                          <small className="barcode-text">{p.barras}</small>
                        </td>
                        <td>
                          <button className="stock-btn" onClick={() => ajustarStock(p, -1)} disabled={p.stock <= 0}>-</button>
                          <span className="stock-value">{p.stock}</span>
                          <button className="stock-btn" onClick={() => ajustarStock(p, 1)}>+</button>
                        </td>
                        <td>${p.precio}</td>
                        <td>${p.precioCredito}</td>
                        <td>
                          <button className="sale-btn" onClick={() => registrarTransaccion(p)}>Venta</button>
                          <button className="credit-btn" onClick={() => registrarTransaccion(p, true)}>Crédito</button>
                          {user.role === 'admin' && (
                            <button className="delete-btn" onClick={() => eliminarProducto(p.id, p.nombre)}>🗑️</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === 'reportes' && (
          <div className="reportes-view fade-in">
            <h2>Reportes de Ventas</h2>
            <div className="report-filters">
              <label>Mes: </label>
              <input type="month" value={mesReporte} onChange={e => setMesReporte(e.target.value)} />
            </div>
            <div className="report-summary">
              <p><strong>Total Ventas:</strong> ${totalVentasMes.toLocaleString()}</p>
              <p><strong>Ganancia Neta:</strong> <span className="profit-text">${gananciaMes.toLocaleString()}</span></p>
            </div>
            <table className="styled-table">
              <thead>
                <tr><th>Fecha</th><th>Producto</th><th>Vendedor</th><th>Cliente</th><th>Total</th><th>Ganancia</th></tr>
              </thead>
              <tbody>
                {ventasFiltradas.map(v => (
                  <tr key={v.id}>
                    <td>{new Date(v.fecha).toLocaleDateString()}</td>
                    <td>{v.producto}</td>
                    <td>{v.vendedor}</td>
                    <td>{v.clienteNombre || 'General'}</td>
                    <td>${v.total}</td>
                    <td className="profit-text">${v.ganancia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'cobrar' && (
          <div className="cobrar-view fade-in">
            <h2>Cuentas por Cobrar</h2>
            
            <button 
              className="add-client-btn" 
              onClick={() => setMostrarFormNuevoCliente(true)}
              style={{ marginBottom: '20px' }}
            >
              + Nuevo Cliente
            </button>

            {clienteSeleccionado ? (
              <div className="cliente-detalle">
                <button className="back-btn" onClick={cerrarDetalleCliente}>← Volver</button>
                <h3>{clienteSeleccionado.nombre}</h3>
                <p><strong>Teléfono:</strong> {clienteSeleccionado.telefono || 'No registrado'}</p>
                <p><strong>Deuda total:</strong> ${clienteSeleccionado.totalDeuda.toLocaleString()}</p>
                
                <h4>Cuentas pendientes</h4>
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Total</th>
                      <th>Abonado</th>
                      <th>Saldo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteSeleccionado.cuentas
                      .filter(c => !c.pagado)
                      .map(cuenta => (
                        <tr key={cuenta.id}>
                          <td>{new Date(cuenta.fecha).toLocaleDateString()}</td>
                          <td>{cuenta.producto}</td>
                          <td>${cuenta.total}</td>
                          <td>${cuenta.abonado || 0}</td>
                          <td>${cuenta.saldo || cuenta.total}</td>
                          <td>
                            <button className="pay-btn" onClick={() => abrirModalAbono(cuenta)}>Abonar</button>
                            <button className="liquidate-btn" onClick={() => liquidarCuenta(cuenta)}>Liquidar</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {clienteSeleccionado.cuentas.filter(c => c.pagado).length > 0 && (
                  <>
                    <h4>Cuentas pagadas</h4>
                    <table className="styled-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Producto</th>
                          <th>Total</th>
                          <th>Abonado</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clienteSeleccionado.cuentas
                          .filter(c => c.pagado)
                          .map(cuenta => (
                            <tr key={cuenta.id}>
                              <td>{new Date(cuenta.fecha).toLocaleDateString()}</td>
                              <td>{cuenta.producto}</td>
                              <td>${cuenta.total}</td>
                              <td>${cuenta.abonado || 0}</td>
                              <td>$0</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ) : (
              <div>
                {clientesConDeuda.length === 0 ? (
                  <p>No hay clientes con deuda</p>
                ) : (
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Teléfono</th>
                        <th>Deuda total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesConDeuda.map(cliente => (
                        <tr key={cliente.nombre}>
                          <td>{cliente.nombre}</td>
                          <td>{cliente.telefono || '—'}</td>
                          <td>${cliente.totalDeuda.toLocaleString()}</td>
                          <td>
                            <button className="view-btn" onClick={() => handleVerCliente(cliente.nombre)}>Ver detalles</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal para abonar */}
      {mostrarModalAbono && cuentaSeleccionada && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Registrar abono</h3>
            <p><strong>Cliente:</strong> {cuentaSeleccionada.clienteNombre}</p>
            <p><strong>Producto:</strong> {cuentaSeleccionada.producto}</p>
            <p><strong>Total:</strong> ${cuentaSeleccionada.total}</p>
            <p><strong>Saldo actual:</strong> ${cuentaSeleccionada.saldo || cuentaSeleccionada.total}</p>
            <input
              type="number"
              placeholder="Monto a abonar"
              value={montoAbono}
              onChange={(e) => setMontoAbono(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="confirm-btn" onClick={realizarAbono}>Confirmar</button>
              <button className="cancel-btn" onClick={() => setMostrarModalAbono(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para nuevo cliente (simple) */}
      {mostrarFormNuevoCliente && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nuevo cliente</h3>
            <input
              type="text"
              placeholder="Nombre"
              value={nuevoCliente.nombre}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
            />
            <input
              type="text"
              placeholder="Teléfono"
              value={nuevoCliente.telefono}
              onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
            />
            <div className="modal-actions">
              <button className="confirm-btn" onClick={() => {
                showNotification(`Cliente ${nuevoCliente.nombre} agregado (simulado)`);
                setNuevoCliente({ nombre: '', telefono: '' });
                setMostrarFormNuevoCliente(false);
              }}>Guardar</button>
              <button className="cancel-btn" onClick={() => setMostrarFormNuevoCliente(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
    </div>
  );
};

export default App;