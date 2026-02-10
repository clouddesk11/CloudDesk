// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================
// ⚠️ REEMPLAZA CON TUS DATOS DE FIREBASE
const firebaseConfig = {
 apiKey: "AIzaSyBKiq_t-gZj_l1Bzj9Y1Jpft03b60pyyuQ",
  authDomain: "eduspace-auth-d7577.firebaseapp.com",
  databaseURL: "https://eduspace-auth-d7577-default-rtdb.firebaseio.com",
  projectId: "eduspace-auth-d7577",
  storageBucket: "eduspace-auth-d7577.firebasestorage.app",
  messagingSenderId: "49398558176",
  appId: "1:49398558176:web:e1c5f750543d5a4d6b4f85"
};


// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================
// SISTEMA DE FINGERPRINTING ROBUSTO
// ============================================
function generateDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const canvasData = canvas.toDataURL();
    
    const data = {
        userAgent: navigator.userAgent,
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        cores: navigator.hardwareConcurrency || 0,
        memory: navigator.deviceMemory || 0,
        canvas: canvasData.substring(0, 50),
        plugins: Array.from(navigator.plugins || []).map(p => p.name).join(','),
        touchSupport: 'ontouchstart' in window
    };
    
    // Generar hash simple pero efectivo
    const jsonString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36) + Date.now().toString(36);
}

function getDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Detectar tablets
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
        return 'mobile'; // Tablets cuentan como mobile
    }
    
    // Detectar móviles
    if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android.*mobile/i.test(userAgent)) {
        return 'mobile';
    }
    
    // Todo lo demás es desktop
    return 'desktop';
}

// ============================================
// VERIFICAR SI CÓDIGO EXISTE EN FIREBASE
// ============================================
async function codigoExisteEnFirebase(codigo) {
    try {
        const codigoRef = database.ref(`codigos/${codigo}`);
        const snapshot = await codigoRef.once('value');
        return snapshot.exists();
    } catch (error) {
        console.error('Error verificando código:', error);
        return false;
    }
}

// ============================================
// VALIDACIÓN CON FIREBASE
// ============================================
async function validateAuthWithFirebase() {
    const authData = localStorage.getItem('eduspace_auth');
    
    if (!authData) return false;
    
    try {
        const parsed = JSON.parse(authData);
        const { codigo, deviceFingerprint, userName } = parsed;
        
        // Verificar si el código existe en Firebase
        const codigoRef = database.ref(`codigos/${codigo}`);
        const snapshot = await codigoRef.once('value');
        const codigoData = snapshot.val();
        
        if (!codigoData) {
            localStorage.removeItem('eduspace_auth');
            showAuthError('Código inválido o eliminado del sistema.');
            return false;
        }
        
        // ⭐ VERIFICAR SI EL CÓDIGO ESTÁ BLOQUEADO
        if (codigoData.bloqueado === true) {
            localStorage.removeItem('eduspace_auth');
            const motivoBloqueo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            showAuthError(`🚫 ACCESO BLOQUEADO: ${motivoBloqueo}`);
            return false;
        }
      
        
        // Verificar si este fingerprint está registrado
        const dispositivos = codigoData.dispositivos || {};
        const dispositivoRegistrado = Object.keys(dispositivos).find(
            key => dispositivos[key].fingerprint === deviceFingerprint
        );
        
        if (!dispositivoRegistrado) {
            // Este dispositivo no está registrado con este código
            localStorage.removeItem('eduspace_auth');
            showAuthError('Sesión inválida. Este dispositivo no está autorizado para este código.');
            return false;
        }
        
        // Actualizar último acceso
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${dispositivoRegistrado}/ultimoAcceso`] = new Date().toISOString();
        await database.ref().update(updates);
        
        // Mostrar mensaje especial si es código 6578hy
        if (codigo === '6578hy') {
            showSpecialUserMessage();
        }
        
        return true;
        
    } catch (e) {
        console.error('Error validando autenticación:', e);
        localStorage.removeItem('eduspace_auth');
        return false;
    }
}

// ============================================
// CONTAR DISPOSITIVOS POR TIPO
// ============================================
function contarDispositivosPorTipo(dispositivos) {
    let mobileCount = 0;
    let desktopCount = 0;
    
    Object.values(dispositivos).forEach(device => {
        if (device.tipo === 'mobile') {
            mobileCount++;
        } else if (device.tipo === 'desktop') {
            desktopCount++;
        }
    });
    
    return { mobile: mobileCount, desktop: desktopCount };
}

// ============================================
// MANEJO DE AUTENTICACIÓN MEJORADO
// ============================================
async function handleAuthSubmit() {
    const userName = document.getElementById('authUserName').value.trim();
    const codigo = document.getElementById('authCode').value.trim();
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');
    
    // Limpiar error previo
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    // Validar campos vacíos
    if (!userName) {
        errorDiv.textContent = 'Por favor, ingresa tu nombre.';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!codigo) {
        errorDiv.textContent = 'Por favor, ingresa tu código.';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Deshabilitar botón durante la validación
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';
    
    try {
        // ⭐ VERIFICAR SI EL CÓDIGO EXISTE EN FIREBASE (SIN CÓDIGOS HARDCODEADOS)
        const codigoExiste = await codigoExisteEnFirebase(codigo);
        
        if (!codigoExiste) {
            errorDiv.textContent = '❌ Código inválido. Verifica con el administrador.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // Generar fingerprint del dispositivo
        const deviceFingerprint = generateDeviceFingerprint();
        const deviceType = getDeviceType();
        
        // Referencia al código en Firebase
        const codigoRef = database.ref(`codigos/${codigo}`);
        const snapshot = await codigoRef.once('value');
        const codigoData = snapshot.val();
        
        // ⭐ VERIFICAR SI EL CÓDIGO ESTÁ BLOQUEADO
        if (codigoData.bloqueado === true) {
            const motivoBloqueo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivoBloqueo}`;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        const dispositivos = codigoData.dispositivos || {};
        
        // Verificar si este dispositivo ya está registrado
        const dispositivoExistente = Object.keys(dispositivos).find(
            key => dispositivos[key].fingerprint === deviceFingerprint
        );
        
        if (dispositivoExistente) {
            // Dispositivo ya registrado, permitir acceso
            const updates = {};
            updates[`codigos/${codigo}/dispositivos/${dispositivoExistente}/usuario`] = userName;
            updates[`codigos/${codigo}/dispositivos/${dispositivoExistente}/ultimoAcceso`] = new Date().toISOString();
            await database.ref().update(updates);
            
            const authData = {
                userName,
                codigo,
                deviceFingerprint,
                deviceType,
                timestamp: Date.now()
            };
            localStorage.setItem('eduspace_auth', JSON.stringify(authData));
            
            document.getElementById('authModal').style.display = 'none';
            if (codigo === '6578hy') {
                showSpecialUserMessage();
            }
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // ⭐ NUEVO DISPOSITIVO - VALIDAR TIPO Y CANTIDAD
        const { mobile, desktop } = contarDispositivosPorTipo(dispositivos);
        
        // Validar límite por tipo de dispositivo
        if (deviceType === 'mobile' && mobile >= 1) {
            errorDiv.textContent = '📱 Este código ya está en uso en 1 dispositivo móvil. Solo se permite 1 móvil por código.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        if (deviceType === 'desktop' && desktop >= 1) {
            errorDiv.textContent = '💻 Este código ya está en uso en 1 computadora. Solo se permite 1 PC/laptop por código.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // Verificar que no se excedan los 2 dispositivos totales
        const totalDispositivos = Object.keys(dispositivos).length;
        if (totalDispositivos >= 2) {
            errorDiv.textContent = '⚠️ Este código ya alcanzó el límite de 2 dispositivos (1 móvil + 1 PC).';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // Registrar nuevo dispositivo
        const dispositivoId = `device_${Date.now()}`;
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${dispositivoId}`] = {
            fingerprint: deviceFingerprint,
            tipo: deviceType,
            usuario: userName,
            fechaRegistro: new Date().toISOString(),
            ultimoAcceso: new Date().toISOString()
        };
        
        // Actualizar contador de usos restantes
        const usosRestantes = Math.max(0, 2 - (totalDispositivos + 1));
        updates[`codigos/${codigo}/usosRestantes`] = usosRestantes;
        
        if (usosRestantes === 0) {
            updates[`codigos/${codigo}/completado`] = true;
        }
        
        await database.ref().update(updates);
        
        // Guardar autenticación local
        const authData = {
            userName,
            codigo,
            deviceFingerprint,
            deviceType,
            timestamp: Date.now()
        };
        localStorage.setItem('eduspace_auth', JSON.stringify(authData));
        
        // Éxito
        document.getElementById('authModal').style.display = 'none';
        if (codigo === '6578hy') {
            showSpecialUserMessage();
        }
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
        
    } catch (error) {
        console.error('Error en autenticación:', error);
        errorDiv.textContent = '❌ Error de conexión. Por favor, intenta nuevamente.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
    }
}

function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function showSpecialUserMessage() {
    const specialMessage = document.getElementById('specialUserMessage');
    if (specialMessage) {
        specialMessage.style.display = 'flex';
    }
}

function hideSpecialUserMessage() {
    const specialMessage = document.getElementById('specialUserMessage');
    if (specialMessage) {
        specialMessage.style.display = 'none';
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await validateAuthWithFirebase();
    
    if (!isAuthenticated) {
        // Mostrar modal de autenticación
        document.getElementById('authModal').style.display = 'flex';
        
        // Event listeners
        document.getElementById('authSubmit').addEventListener('click', handleAuthSubmit);
        
        document.getElementById('authUserName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuthSubmit();
            }
        });
        
        document.getElementById('authCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuthSubmit();
            }
        });
    } else {
        // Usuario autenticado
        document.getElementById('authModal').style.display = 'none';
    }
    
    // Continuar con inicialización normal
    updatePendingBadge();
    switchTab('repositorio');
});

// ============================================
// RESTO DEL CÓDIGO ORIGINAL
// ============================================

// Base de datos de profesores con fotos y teléfonos
const teachersDB = {
    "Prof. Alejandro Ruiz": {
        name: "Prof. Alejandro Ruiz",
        title: "Profesor de Matemáticas",
        photo: "https://i.pravatar.cc/150?img=12",
        email: "alejandro.ruiz@eduspace.com",
        phone: "+51 987 654 321"
    },
    "Dra. María González": {
        name: "Dra. María González",
        title: "Doctora en  Biológicas",
        photo: "https://i.pravatar.cc/150?img=12",
        email: "alejandro.ruiz@eduspace.com",
        phone: "+51 987 654 321"
    },
   "Lic. Carlos Fuentes": {
        name: "Lic. Carlos Fuentes",
        title: "Licenciado en Literatura",
        photo: "https://i.pravatar.cc/150?img=12",
        email: "alejandro.ruiz@eduspace.com",
        phone: "+51 987 654 321"
    },
   "Prof. Diana Prince": {
        name: "Prof. Diana Prince",
        title: "Profesora de Historia",
        photo: "https://i.pravatar.cc/150?img=12",
        email: "alejandro.ruiz@eduspace.com",
        phone: "+51 987 654 321"
    }
  
  
};

// Base de datos de estudiantes
const studentsDB = [
    { id: 1, name: "Ana María López", photo: "https://i.pravatar.cc/150?img=1", code: "EST-2025-001" },
    { id: 2, name: "Carlos Mendoza", photo: "https://i.pravatar.cc/150?img=13", code: "EST-2025-002" },
    { id: 3, name: "Diana Flores", photo: "https://i.pravatar.cc/150?img=5", code: "EST-2025-003" },
    { id: 4, name: "Eduardo Ramírez", photo: "https://i.pravatar.cc/150?img=15", code: "EST-2025-004" },
    { id: 5, name: "Fernanda Castro", photo: "https://i.pravatar.cc/150?img=9", code: "EST-2025-005" },
    { id: 6, name: "Gabriel Torres", photo: "https://i.pravatar.cc/150?img=17", code: "EST-2025-006" },
    { id: 7, name: "Helena Vargas", photo: "https://i.pravatar.cc/150?img=10", code: "EST-2025-007" },
    { id: 8, name: "Ignacio Rojas", photo: "https://i.pravatar.cc/150?img=18", code: "EST-2025-008" },
    { id: 9, name: "Julia Morales", photo: "https://i.pravatar.cc/150?img=23", code: "EST-2025-009" },
    { id: 10, name: "Kevin Sánchez", photo: "https://i.pravatar.cc/150?img=20", code: "EST-2025-010" },
    { id: 11, name: "Laura Gutiérrez", photo: "https://i.pravatar.cc/150?img=24", code: "EST-2025-011" },
    { id: 12, name: "Miguel Herrera", photo: "https://i.pravatar.cc/150?img=21", code: "EST-2025-012" }
];


// Referencias al DOM
const filesGrid = document.getElementById('files-grid');
const assignmentsContainer = document.getElementById('assignments-container');
const finalizadosContainer = document.getElementById('finalizados-container');
const recursosContainer = document.getElementById('recursos-container');
const docentesGrid = document.getElementById('docentes-grid');
const estudiantesGrid = document.getElementById('estudiantes-grid');

const sectionRepositorio = document.getElementById('repositorio');
const sectionTrabajos = document.getElementById('trabajos');
const sectionRecursos = document.getElementById('recursos');
const sectionDocentes = document.getElementById('docentes');
const sectionEstudiantes = document.getElementById('estudiantes');

const trabajosPendientesSection = document.getElementById('trabajos-pendientes-section');
const trabajosFinalizadosSection = document.getElementById('trabajos-finalizados-section');

const tabRepositorio = document.getElementById('tab-repositorio');
const tabTrabajos = document.getElementById('tab-trabajos');
const tabRecursos = document.getElementById('tab-recursos');
const tabDocentes = document.getElementById('tab-docentes');
const tabEstudiantes = document.getElementById('tab-estudiantes');

const profileModal = document.getElementById('profileModal');
const modalProfileImage = document.getElementById('modalProfileImage');
const modalProfileInfo = document.getElementById('modalProfileInfo');
const detailsModal = document.getElementById('detailsModal');
const fileViewerModal = document.getElementById('fileViewerModal');
const fileViewerContent = document.getElementById('fileViewerContent');
const completedModal = document.getElementById('completedModal');

let currentFilter = 'all';
let currentTab = 'repositorio';
let currentAssignmentToComplete = null;
let showingFinalizados = false;
let fullscreenCloseBtn = null;

// LocalStorage Management
function getCompletedAssignments() {
    const completed = localStorage.getItem('completedAssignments');
    return completed ? JSON.parse(completed) : [];
}

function saveCompletedAssignment(assignmentId) {
    const completed = getCompletedAssignments();
    if (!completed.includes(assignmentId)) {
        completed.push(assignmentId);
        localStorage.setItem('completedAssignments', JSON.stringify(completed));
    }
}

function getPendingAssignments() {
    const completed = getCompletedAssignments();
    return assignmentsDB.filter(a => !completed.includes(a.id));
}

function getFinishedAssignments() {
    const completed = getCompletedAssignments();
    return assignmentsDB.filter(a => completed.includes(a.id));
}

function toggleSearch(section) {
    const searchBar = document.getElementById(`searchBar${section.charAt(0).toUpperCase() + section.slice(1)}`);
    const searchInput = searchBar.querySelector('input');
    
    searchBar.classList.toggle('active');
    
    if (searchBar.classList.contains('active')) {
        setTimeout(() => searchInput.focus(), 300);
    } else {
        searchInput.value = '';
        searchFiles();
    }
}

function updatePendingBadge() {
    const pendingCount = getPendingAssignments().length;
    const badge = document.getElementById('pending-badge');
    
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function normalizeText(text) {
    return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function calculateRelevance(item, searchTerms, searchableFields) {
    let score = 0;
    const normalizedFields = searchableFields.map(field => normalizeText(item[field] || ''));
    
    searchTerms.forEach(term => {
        normalizedFields.forEach((field, index) => {
            if (field.includes(term)) {
                if (field === term) {
                    score += 10;
                }
                else if (field.startsWith(term)) {
                    score += 5;
                }
                else {
                    score += 2;
                }
                
                if (index === 0) {
                    score += 3;
                }
            }
        });
    });
    
    return score;
}

function searchFiles() {
    let searchTerm = '';
    
    if (currentTab === 'repositorio') {
        searchTerm = document.getElementById('searchInputRepositorio').value.toLowerCase().trim();
    } else if (currentTab === 'recursos') {
        searchTerm = document.getElementById('searchInputRecursos').value.toLowerCase().trim();
    } else {
        return;
    }
    
    if (searchTerm === '') {
        if (currentTab === 'repositorio') {
            renderFiles(currentFilter);
        } else if (currentTab === 'recursos') {
            renderRecursos();
        }
        return;
    }
    
    const searchTerms = normalizeText(searchTerm).split(/\s+/);
    
    if (currentTab === 'repositorio') {
        const filteredFiles = filesDB
            .filter(file => currentFilter === 'all' || file.area === currentFilter)
            .map(file => ({
                ...file,
                relevance: calculateRelevance(file, searchTerms, ['title', 'area', 'teacher'])
            }))
            .filter(file => file.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance);
        
        renderFilesArray(filteredFiles);
    } else if (currentTab === 'recursos') {
        const filteredRecursos = recursosDB
            .map(recurso => ({
                ...recurso,
                relevance: calculateRelevance(recurso, searchTerms, ['title', 'description'])
            }))
            .filter(recurso => recurso.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance);
        
        renderRecursosArray(filteredRecursos);
    }
}

function renderFiles(filter = 'all') {
    currentFilter = filter;
    filesGrid.innerHTML = '';
    const filteredFiles = filter === 'all'
        ? filesDB
        : filesDB.filter(file => file.area === filter);
    
    renderFilesArray(filteredFiles);
}

function renderFilesArray(files) {
    filesGrid.innerHTML = '';
    
    if (files.length === 0) {
        filesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No se encontraron archivos.</p>';
        return;
    }
    
    files.forEach(file => {
        const teacher = teachersDB[file.teacher];
        const card = document.createElement('div');
        card.classList.add('file-card');
        card.innerHTML = `
            <div class="card-header">
                <i class="fa-regular fa-file-lines file-icon"></i>
                <span class="badge">${file.area}</span>
            </div>
            <h3 class="file-title">${file.title}</h3>
            <div class="file-details">
                <p><i class="fa-regular fa-calendar"></i> ${file.date}</p>
                <div class="teacher-profile">
                    <img src="${teacher.photo}" 
                         alt="${teacher.name}" 
                         class="teacher-avatar"
                         onclick="openProfileModal('${file.teacher}')">
                    <span class="teacher-name">${teacher.name}</span>
                </div>
            </div>
            <div class="card-actions">
                <button onclick="viewFile('${file.urlView}')" class="btn btn-view">
                    <i class="fa-regular fa-eye"></i> Ver
                </button>
                <a href="${file.urlDownload}" download class="btn btn-download">
                    <i class="fa-solid fa-download"></i> Descargar
                </a>
            </div>
        `;
        filesGrid.appendChild(card);
    });
}

function viewFile(url) {
    fileViewerContent.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-header">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-text">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
            </div>
            <div class="skeleton-body">
                <div class="skeleton-line"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line"></div>
            </div>
        </div>
    `;
    
    fileViewerModal.style.display = 'block';
    
    let previewUrl = url;
    if (!previewUrl.includes('/preview')) {
        if (previewUrl.includes('/edit')) {
            previewUrl = previewUrl.replace('/edit', '/preview');
        } else if (previewUrl.includes('drive.google.com/file/d/')) {
            previewUrl = previewUrl.replace('/view', '/preview');
        }
    }
    
    setTimeout(() => {
        fileViewerContent.innerHTML = `
            <iframe 
                id="googleDriveFrame" 
                src="${previewUrl}" 
                frameborder="0"
                class="google-drive-iframe">
            </iframe>
        `;
    }, 800);
}

function openFullscreen() {
    const iframe = document.getElementById('googleDriveFrame');
    if (iframe) {
        if (!fullscreenCloseBtn) {
            fullscreenCloseBtn = document.createElement('button');
            fullscreenCloseBtn.className = 'fullscreen-close-btn';
            fullscreenCloseBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            fullscreenCloseBtn.onclick = exitFullscreen;
            document.body.appendChild(fullscreenCloseBtn);
        }
        
        if (iframe.requestFullscreen) {
            iframe.requestFullscreen().then(() => {
                fullscreenCloseBtn.classList.add('active');
            });
        } else if (iframe.webkitRequestFullscreen) {
            iframe.webkitRequestFullscreen();
            fullscreenCloseBtn.classList.add('active');
        } else if (iframe.msRequestFullscreen) {
            iframe.msRequestFullscreen();
            fullscreenCloseBtn.classList.add('active');
        }
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    if (fullscreenCloseBtn) {
        fullscreenCloseBtn.classList.remove('active');
    }
}

function handleFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (fullscreenCloseBtn) {
            fullscreenCloseBtn.classList.remove('active');
        }
    }
}

function closeFileViewerModal() {
    fileViewerModal.style.display = 'none';
    fileViewerContent.innerHTML = '';
    
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        exitFullscreen();
    }
}

function toggleTrabajosFinalizados() {
    showingFinalizados = !showingFinalizados;
    const btnText = document.getElementById('btn-trabajos-text');
    const btn = document.getElementById('btn-trabajos-finalizados');
    const btnIcon = btn.querySelector('i');
    
    if (showingFinalizados) {
        trabajosPendientesSection.style.display = 'none';
        trabajosFinalizadosSection.style.display = 'block';
        btnText.textContent = 'Ver trabajos pendientes';
        btnIcon.className = 'fa-solid fa-clock';
        btn.classList.add('showing-finalizados');
        renderFinalizados();
    } else {
        trabajosPendientesSection.style.display = 'block';
        trabajosFinalizadosSection.style.display = 'none';
        btnText.textContent = 'Ver trabajos finalizados';
        btnIcon.className = 'fa-solid fa-check-circle';
        btn.classList.remove('showing-finalizados');
    }
}

function renderAssignments() {
    assignmentsContainer.innerHTML = '';
    const pendingAssignments = getPendingAssignments();
    
    if (pendingAssignments.length === 0) {
        assignmentsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay trabajos pendientes. ¡Excelente trabajo!</p>';
        return;
    }
    
    pendingAssignments.forEach(work => {
        const teacher = teachersDB[work.teacher];
        let statusClass = '';
        switch(work.status) {
            case 'Pendiente': statusClass = 'status-pending'; break;
            case 'Entregado': statusClass = 'status-submitted'; break;
            case 'Atrasado': statusClass = 'status-late'; break;
        }
        
        const card = document.createElement('div');
        card.classList.add('assignment-card');
        card.innerHTML = `
            <div class="assignment-header">
                <h3 class="assignment-title">${work.task}</h3>
                <span class="status-badge ${statusClass}">${work.status}</span>
            </div>
            <div class="assignment-teacher">
                <img src="${teacher.photo}" 
                     alt="${teacher.name}" 
                     class="teacher-avatar-card"
                     onclick="openProfileModal('${work.teacher}')">
                <div class="teacher-info">
                    <span class="teacher-info-name">${teacher.name}</span>
                    <span class="teacher-info-title">${teacher.title}</span>
                </div>
            </div>
            <div class="assignment-meta">
                <div class="meta-item">
                    <i class="fa-regular fa-calendar"></i>
                    <span>Fecha límite: ${work.deadline}</span>
                </div>
            </div>
            <div class="assignment-actions">
                <button class="btn btn-view" onclick="openDetailsModal(${work.id})">
                    <i class="fa-solid fa-info-circle"></i> Ver Detalles
                </button>
                <button class="btn btn-completed" onclick="openCompletedModal(${work.id})">
                    <i class="fa-solid fa-check-circle"></i> Cumplido
                </button>
            </div>
        `;
        assignmentsContainer.appendChild(card);
    });
}

function renderFinalizados() {
    finalizadosContainer.innerHTML = '';
    const finishedAssignments = getFinishedAssignments();
    
    if (finishedAssignments.length === 0) {
        finalizadosContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay trabajos finalizados aún.</p>';
        return;
    }
    
    finishedAssignments.forEach(work => {
        const teacher = teachersDB[work.teacher];
        
        const card = document.createElement('div');
        card.classList.add('assignment-card');
        card.innerHTML = `
            <div class="assignment-header">
                <h3 class="assignment-title">${work.task}</h3>
                <span class="status-badge status-submitted">Finalizado</span>
            </div>
            <div class="assignment-teacher">
                <img src="${teacher.photo}" 
                     alt="${teacher.name}" 
                     class="teacher-avatar-card"
                     onclick="openProfileModal('${work.teacher}')">
                <div class="teacher-info">
                    <span class="teacher-info-name">${teacher.name}</span>
                    <span class="teacher-info-title">${teacher.title}</span>
                </div>
            </div>
            <div class="assignment-meta">
                <div class="meta-item">
                    <i class="fa-regular fa-calendar"></i>
                    <span>Fecha límite: ${work.deadline}</span>
                </div>
                <div class="meta-item">
                    <i class="fa-solid fa-check"></i>
                    <span>Completado</span>
                </div>
            </div>
            <div class="assignment-actions">
                <button class="btn btn-view" onclick="openDetailsModal(${work.id})">
                    <i class="fa-solid fa-info-circle"></i> Ver Detalles
                </button>
            </div>
        `;
        finalizadosContainer.appendChild(card);
    });
}

function openCompletedModal(assignmentId) {
    const assignment = assignmentsDB.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    currentAssignmentToComplete = assignmentId;
    
    const teacher = teachersDB[assignment.teacher];
    const message = `Has finalizado el trabajo pendiente de <strong>${teacher.name}</strong> con los siguientes datos:<br><br>
        <strong>Trabajo:</strong> ${assignment.task}<br>
        <strong>Fecha límite:</strong> ${assignment.deadline}<br><br>
        Al finalizar, se eliminará de 'Trabajos Pendientes' y se moverá a 'Trabajos Finalizados'.`;
    
    document.getElementById('completedMessage').innerHTML = message;
    completedModal.style.display = 'block';
}

function closeCompletedModal() {
    completedModal.style.display = 'none';
    currentAssignmentToComplete = null;
}

function confirmCompleted() {
    if (currentAssignmentToComplete) {
        saveCompletedAssignment(currentAssignmentToComplete);
        updatePendingBadge();
        renderAssignments();
        closeCompletedModal();
    }
}

function renderRecursos() {
    renderRecursosArray(recursosDB);
}

function renderRecursosArray(recursos) {
    recursosContainer.innerHTML = '';
    
    if (recursos.length === 0) {
        recursosContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No se encontraron recursos.</p>';
        return;
    }
    
    recursos.forEach(recurso => {
        const recursoItem = document.createElement('div');
        recursoItem.classList.add('recurso-item');
        
        let icon = 'fa-file-lines';
        if (recurso.type === 'PDF') icon = 'fa-file-pdf';
        else if (recurso.type === 'DOCX' || recurso.type === 'DOC') icon = 'fa-file-word';
        else if (recurso.type === 'PPTX' || recurso.type === 'PPT') icon = 'fa-file-powerpoint';
        else if (recurso.type === 'XLSX' || recurso.type === 'XLS') icon = 'fa-file-excel';
        
        recursoItem.innerHTML = `
            <div class="recurso-info">
                <i class="fa-solid ${icon} recurso-icon"></i>
                <div class="recurso-details">
                    <h3 class="recurso-title">${recurso.title}</h3>
                    <p class="recurso-description">${recurso.description}</p>
                </div>
            </div>
            <div class="recurso-actions">
                <button onclick="viewFile('${recurso.urlView}')" class="btn btn-view">
                    <i class="fa-regular fa-eye"></i> Ver
                </button>
                <a href="${recurso.urlDownload}" download class="btn btn-download">
                    <i class="fa-solid fa-download"></i> Descargar
                </a>
            </div>
        `;
        
        recursosContainer.appendChild(recursoItem);
    });
}

function renderDocentes() {
    const teachersArray = Object.values(teachersDB);
    renderDocentesArray(teachersArray);
}

function renderDocentesArray(teachers) {
    docentesGrid.innerHTML = '';
    
    if (teachers.length === 0) {
        docentesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No se encontraron docentes.</p>';
        return;
    }
    
    teachers.forEach(teacher => {
        const docenteCard = document.createElement('div');
        docenteCard.classList.add('docente-card');
        
        docenteCard.innerHTML = `
            <img src="${teacher.photo}" alt="${teacher.name}" class="docente-avatar-large">
            <h3 class="docente-name">${teacher.name}</h3>
            <p class="docente-title">${teacher.title}</p>
            <div class="docente-info">
                <p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p>
                <p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p>
            </div>
        `;
        
        docentesGrid.appendChild(docenteCard);
    });
}

function renderEstudiantes() {
    estudiantesGrid.innerHTML = '';
    
    if (studentsDB.length === 0) {
        estudiantesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No hay estudiantes registrados.</p>';
        return;
    }
    
    studentsDB.forEach(student => {
        const estudianteCard = document.createElement('div');
        estudianteCard.classList.add('estudiante-card');
        
        estudianteCard.innerHTML = `
            <img src="${student.photo}" alt="${student.name}" class="estudiante-avatar">
            <h3 class="estudiante-name">${student.name}</h3>
            <p class="estudiante-code">${student.code}</p>
        `;
        
        estudiantesGrid.appendChild(estudianteCard);
    });
}

function filterFiles(area) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderFiles(area);
    document.getElementById('searchInputRepositorio').value = '';
}

function switchTab(tab) {
    currentTab = tab;
    showingFinalizados = false;
    
    sectionRepositorio.style.display = 'none';
    sectionTrabajos.style.display = 'none';
    sectionRecursos.style.display = 'none';
    sectionDocentes.style.display = 'none';
    sectionEstudiantes.style.display = 'none';
    
    tabRepositorio.classList.remove('active');
    tabTrabajos.classList.remove('active');
    tabRecursos.classList.remove('active');
    tabDocentes.classList.remove('active');
    tabEstudiantes.classList.remove('active');
    
    const searchInputRepo = document.getElementById('searchInputRepositorio');
    const searchInputRec = document.getElementById('searchInputRecursos');
    if (searchInputRepo) searchInputRepo.value = '';
    if (searchInputRec) searchInputRec.value = '';
    
    if (tab === 'repositorio') {
        sectionRepositorio.style.display = 'block';
        tabRepositorio.classList.add('active');
        renderFiles();
    } else if (tab === 'trabajos') {
        sectionTrabajos.style.display = 'block';
        tabTrabajos.classList.add('active');
        trabajosPendientesSection.style.display = 'block';
        trabajosFinalizadosSection.style.display = 'none';
        const btn = document.getElementById('btn-trabajos-finalizados');
        const btnIcon = btn.querySelector('i');
        document.getElementById('btn-trabajos-text').textContent = 'Ver trabajos finalizados';
        btnIcon.className = 'fa-solid fa-check-circle';
        btn.classList.remove('showing-finalizados');
        renderAssignments();
    } else if (tab === 'recursos') {
        sectionRecursos.style.display = 'block';
        tabRecursos.classList.add('active');
        renderRecursos();
    } else if (tab === 'docentes') {
        sectionDocentes.style.display = 'block';
        tabDocentes.classList.add('active');
        renderDocentes();
    } else if (tab === 'estudiantes') {
        sectionEstudiantes.style.display = 'block';
        tabEstudiantes.classList.add('active');
        renderEstudiantes();
    }
}

function openProfileModal(teacherName) {
    const teacher = teachersDB[teacherName];
    if (!teacher) return;
    
    modalProfileImage.src = teacher.photo;
    modalProfileImage.alt = teacher.name;
    modalProfileInfo.innerHTML = `
        <h3>${teacher.name}</h3>
        <p><strong>${teacher.title}</strong></p>
        <p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p>
        <p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p>
    `;
    
    profileModal.style.display = 'block';
}

function closeProfileModal() {
    profileModal.style.display = 'none';
}

function openDetailsModal(assignmentId) {
    const assignment = assignmentsDB.find(a => a.id === assignmentId);
    if (!assignment) return;

    const teacher = teachersDB[assignment.teacher];
    
    document.getElementById('detailsTaskName').textContent = assignment.task;
    document.getElementById('detailsTeacher').textContent = assignment.teacher;
    document.getElementById('detailsDeadline').textContent = assignment.deadline;
    
    let statusClass = '';
    const completed = getCompletedAssignments();
    const isCompleted = completed.includes(assignment.id);
    
    if (isCompleted) {
        statusClass = 'status-submitted';
        document.getElementById('detailsStatus').innerHTML = `<span class="status-badge ${statusClass}">Finalizado</span>`;
    } else {
        switch(assignment.status) {
            case 'Pendiente': statusClass = 'status-pending'; break;
            case 'Entregado': statusClass = 'status-submitted'; break;
            case 'Atrasado': statusClass = 'status-late'; break;
        }
        document.getElementById('detailsStatus').innerHTML = `<span class="status-badge ${statusClass}">${assignment.status}</span>`;
    }
    
    document.getElementById('detailsDescription').textContent = assignment.description;
    
    const requirementsList = document.getElementById('detailsRequirements');
    requirementsList.innerHTML = '';
    assignment.requirements.forEach(req => {
        const li = document.createElement('li');
        li.textContent = req;
        requirementsList.appendChild(li);
    });
    
    const attachmentsList = document.getElementById('detailsAttachments');
    attachmentsList.innerHTML = '';
    if (assignment.attachments && assignment.attachments.length > 0) {
        assignment.attachments.forEach(att => {
            const attachDiv = document.createElement('div');
            attachDiv.classList.add('attachment-item');
            
            let icon = 'fa-file-lines';
            if (att.type === 'PDF') icon = 'fa-file-pdf';
            else if (att.type === 'Word' || att.type === 'DOCX') icon = 'fa-file-word';
            else if (att.type === 'Excel') icon = 'fa-file-excel';
            else if (att.type === 'PowerPoint') icon = 'fa-file-powerpoint';
            
            attachDiv.innerHTML = `
                <div class="attachment-info">
                    <i class="fa-solid ${icon} attachment-icon"></i>
                    <div class="attachment-details">
                        <h5>${att.name}</h5>
                        <p>${att.size}</p>
                    </div>
                </div>
                <a href="${att.downloadUrl}" target="_blank" class="attachment-download">
                    <i class="fa-solid fa-download"></i> Descargar
                </a>
            `;
            attachmentsList.appendChild(attachDiv);
        });
    } else {
        attachmentsList.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No hay archivos adjuntos</p>';
    }
    
    detailsModal.style.display = 'block';
}

function closeDetailsModal() {
    detailsModal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target === profileModal) {
        closeProfileModal();
    }
    if (event.target === detailsModal) {
        closeDetailsModal();
    }
    if (event.target === fileViewerModal) {
        closeFileViewerModal();
    }
    if (event.target === completedModal) {
        closeCompletedModal();
    }
}

// ============================================
// LISTENER DE BLOQUEO EN TIEMPO REAL
// ============================================
let bloqueoListener = null;

function iniciarListenerBloqueo() {
    const authData = localStorage.getItem('eduspace_auth');
    
    if (!authData) return;
    
    try {
        const parsed = JSON.parse(authData);
        const { codigo } = parsed;
        
        // Si ya existe un listener, desconectarlo primero
        if (bloqueoListener) {
            database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener);
        }
        
        // Crear listener para monitorear cambios en el estado de bloqueo
        bloqueoListener = database.ref(`codigos/${codigo}/bloqueado`).on('value', (snapshot) => {
            const estaBloqueado = snapshot.val();
            
            if (estaBloqueado === true) {
                // El código fue bloqueado - obtener motivo
                database.ref(`codigos/${codigo}/motivoBloqueo`).once('value', (motivoSnapshot) => {
                    const motivo = motivoSnapshot.val() || 'Tu acceso ha sido bloqueado por el administrador.';
                    
                    // Mostrar modal de autenticación con error
                    document.getElementById('authModal').style.display = 'flex';
                    
                    // Mostrar error de bloqueo
                    const errorDiv = document.getElementById('authError');
                    errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`;
                    errorDiv.style.display = 'block';
                    
                    // Limpiar solo la autenticación, pero mantener los datos por si se desbloquea
                    // NO borramos todo el localStorage, solo marcamos como bloqueado temporalmente
                    
                    // Ocultar mensaje especial si existía
                    hideSpecialUserMessage();
                    
                    // Opcional: Desactivar botones del formulario
                    document.getElementById('authSubmit').disabled = true;
                    document.getElementById('authSubmit').innerHTML = '<i class="fa-solid fa-ban"></i> Acceso Bloqueado';
                });
                
            } else if (estaBloqueado === false) {
                // El código fue desbloqueado
                const authData = localStorage.getItem('eduspace_auth');
                
                if (authData) {
                    // Si tiene datos guardados, validar y permitir acceso automático
                    validateAuthWithFirebase().then(isValid => {
                        if (isValid) {
                            // Cerrar modal de autenticación
                            document.getElementById('authModal').style.display = 'none';
                            
                            // Limpiar mensajes de error
                            const errorDiv = document.getElementById('authError');
                            errorDiv.textContent = '';
                            errorDiv.style.display = 'none';
                            
                            // Reactivar botón
                            document.getElementById('authSubmit').disabled = false;
                            document.getElementById('authSubmit').innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
                            
                            // Mostrar mensaje especial si es código 6578hy
                            const parsed = JSON.parse(authData);
                            if (parsed.codigo === '6578hy') {
                                showSpecialUserMessage();
                            }
                            
                            // Opcional: Mostrar notificación de desbloqueo
                            mostrarNotificacionDesbloqueo();
                        }
                    });
                }
            }
        });
        
    } catch (e) {
        console.error('Error iniciando listener de bloqueo:', e);
    }
}

function mostrarNotificacionDesbloqueo() {
    // Crear notificación temporal
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #0d9668);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        z-index: 9999;
        animation: slideInRight 0.5s ease;
    `;
    notif.innerHTML = `
        <i class="fa-solid fa-check-circle" style="font-size: 1.5rem;"></i>
        <span>Tu acceso ha sido restaurado</span>
    `;
    
    document.body.appendChild(notif);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => notif.remove(), 500);
    }, 5000);
}

// ============================================
// MODIFICAR LA FUNCIÓN handleAuthSubmit
// ============================================
// REEMPLAZA tu función handleAuthSubmit actual con esta versión mejorada:

async function handleAuthSubmit() {
    const userName = document.getElementById('authUserName').value.trim();
    const codigo = document.getElementById('authCode').value.trim();
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');
    
    // Limpiar error previo
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    // Validar campos vacíos
    if (!userName) {
        errorDiv.textContent = 'Por favor, ingresa tu nombre.';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!codigo) {
        errorDiv.textContent = 'Por favor, ingresa tu código.';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Deshabilitar botón durante la validación
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';
    
    try {
        // Verificar si el código existe en Firebase
        const codigoExiste = await codigoExisteEnFirebase(codigo);
        
        if (!codigoExiste) {
            errorDiv.textContent = '❌ Código inválido. Verifica con el administrador.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // Generar fingerprint del dispositivo
        const deviceFingerprint = generateDeviceFingerprint();
        const deviceType = getDeviceType();
        
        // Referencia al código en Firebase
        const codigoRef = database.ref(`codigos/${codigo}`);
        const snapshot = await codigoRef.once('value');
        const codigoData = snapshot.val();
        
        // Verificar si el código está bloqueado
        if (codigoData.bloqueado === true) {
            const motivoBloqueo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivoBloqueo}`;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        const dispositivos = codigoData.dispositivos || {};
        
        // Verificar si este dispositivo ya está registrado
        const dispositivoExistente = Object.keys(dispositivos).find(
            key => dispositivos[key].fingerprint === deviceFingerprint
        );
        
        if (dispositivoExistente) {
            // Dispositivo ya registrado, permitir acceso
            const updates = {};
            updates[`codigos/${codigo}/dispositivos/${dispositivoExistente}/usuario`] = userName;
            updates[`codigos/${codigo}/dispositivos/${dispositivoExistente}/ultimoAcceso`] = new Date().toISOString();
            await database.ref().update(updates);
            
            const authData = {
                userName,
                codigo,
                deviceFingerprint,
                deviceType,
                timestamp: Date.now()
            };
            localStorage.setItem('eduspace_auth', JSON.stringify(authData));
            
            document.getElementById('authModal').style.display = 'none';
            if (codigo === '6578hy') {
                showSpecialUserMessage();
            }
            
            // ⭐ INICIAR LISTENER DE BLOQUEO EN TIEMPO REAL
            iniciarListenerBloqueo();
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // Nuevo dispositivo - validar tipo y cantidad
        const { mobile, desktop } = contarDispositivosPorTipo(dispositivos);
        
        if (deviceType === 'mobile' && mobile >= 1) {
            errorDiv.textContent = '📱 Este código ya está en uso en 1 dispositivo móvil. Solo se permite 1 móvil por código.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        if (deviceType === 'desktop' && desktop >= 1) {
            errorDiv.textContent = '💻 Este código ya está en uso en 1 computadora. Solo se permite 1 PC/laptop por código.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        const totalDispositivos = Object.keys(dispositivos).length;
        if (totalDispositivos >= 2) {
            errorDiv.textContent = '⚠️ Este código ya alcanzó el límite de 2 dispositivos (1 móvil + 1 PC).';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }
        
        // Registrar nuevo dispositivo
        const dispositivoId = `device_${Date.now()}`;
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${dispositivoId}`] = {
            fingerprint: deviceFingerprint,
            tipo: deviceType,
            usuario: userName,
            fechaRegistro: new Date().toISOString(),
            ultimoAcceso: new Date().toISOString()
        };
        
        const usosRestantes = Math.max(0, 2 - (totalDispositivos + 1));
        updates[`codigos/${codigo}/usosRestantes`] = usosRestantes;
        
        if (usosRestantes === 0) {
            updates[`codigos/${codigo}/completado`] = true;
        }
        
        await database.ref().update(updates);
        
        // Guardar autenticación local
        const authData = {
            userName,
            codigo,
            deviceFingerprint,
            deviceType,
            timestamp: Date.now()
        };
        localStorage.setItem('eduspace_auth', JSON.stringify(authData));
        
        // Éxito
        document.getElementById('authModal').style.display = 'none';
        if (codigo === '6578hy') {
            showSpecialUserMessage();
        }
        
        // ⭐ INICIAR LISTENER DE BLOQUEO EN TIEMPO REAL
        iniciarListenerBloqueo();
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
        
    } catch (error) {
        console.error('Error en autenticación:', error);
        errorDiv.textContent = '❌ Error de conexión. Por favor, intenta nuevamente.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
    }
}

// ============================================
// MODIFICAR EL DOMContentLoaded PARA INCLUIR EL LISTENER
// ============================================
// REEMPLAZA tu código DOMContentLoaded actual con este:

document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await validateAuthWithFirebase();
    
    if (!isAuthenticated) {
        // Mostrar modal de autenticación
        document.getElementById('authModal').style.display = 'flex';
        
        // Event listeners
        document.getElementById('authSubmit').addEventListener('click', handleAuthSubmit);
        
        document.getElementById('authUserName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuthSubmit();
            }
        });
        
        document.getElementById('authCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuthSubmit();
            }
        });
    } else {
        // Usuario autenticado
        document.getElementById('authModal').style.display = 'none';
        
        // ⭐ INICIAR LISTENER DE BLOQUEO EN TIEMPO REAL
        iniciarListenerBloqueo();
        
        // ⭐ SOLICITAR PERMISO PARA NOTIFICACIONES (solo para usuarios autenticados)
        setTimeout(() => {
            solicitarPermisoNotificaciones();
        }, 3000); // Esperar 3 segundos después del login
    }
  
    
    // Continuar con inicialización normal
    updatePendingBadge();
    switchTab('repositorio');
});

// ============================================
// LIMPIAR LISTENER AL CERRAR LA PÁGINA (OPCIONAL PERO RECOMENDADO)
// ============================================
window.addEventListener('beforeunload', () => {
    const authData = localStorage.getItem('eduspace_auth');
    
    if (authData && bloqueoListener) {
        try {
            const parsed = JSON.parse(authData);
            const { codigo } = parsed;
            database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener);
        } catch (e) {
            console.error('Error limpiando listener:', e);
        }
    }
});


// ============================================
// MÓDULO DE NOTIFICACIONES PUSH
// ============================================
// Agrega este código a tu script.js (después de la inicialización de Firebase)

// Inicializar Firebase Messaging
let messaging = null;

try {
    messaging = firebase.messaging();
} catch (error) {
    console.error('Error inicializando Firebase Messaging:', error);
}

// ============================================
// CONFIGURAR VAPID KEY
// ============================================
// ⚠️ IMPORTANTE: Debes generar tu VAPID key en Firebase Console
// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates > Generate key pair
const VAPID_KEY = 'BKV0uIbb7wu936a81968wubvxkVMeelKU1zUSB3OrcSvk9ua2AWeq21-bABhJmDYiQ_EgA_2llOsEN0OsLI_m-A';
 // Reemplaza con tu VAPID key real

// ============================================
// SOLICITAR PERMISO PARA NOTIFICACIONES
// ============================================
async function solicitarPermisoNotificaciones() {
    try {
        // Verificar si el navegador soporta notificaciones
        if (!('Notification' in window)) {
            console.log('Este navegador no soporta notificaciones');
            return false;
        }

        // Verificar si ya se otorgó permiso
        if (Notification.permission === 'granted') {
            console.log('Permiso de notificaciones ya otorgado');
            await registrarTokenFCM();
            return true;
        }

        // Si está denegado, no preguntar de nuevo
        if (Notification.permission === 'denied') {
            console.log('Permiso de notificaciones denegado');
            return false;
        }

        // Mostrar modal personalizado antes de pedir permiso
        const deseaNotificaciones = await mostrarModalPermisoNotificaciones();
        
        if (!deseaNotificaciones) {
            return false;
        }

        // Solicitar permiso
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Permiso de notificaciones otorgado');
            await registrarTokenFCM();
            mostrarNotificacionExito('¡Notificaciones activadas! Te avisaremos de nuevos trabajos.');
            return true;
        } else {
            console.log('Permiso de notificaciones denegado');
            return false;
        }
        
    } catch (error) {
        console.error('Error solicitando permiso:', error);
        return false;
    }
}

// ============================================
// MODAL PERSONALIZADO PARA PEDIR PERMISO
// ============================================
function mostrarModalPermisoNotificaciones() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
                border-radius: 20px;
                padding: 2.5rem;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3);
                border: 2px solid #3b82f6;
                text-align: center;
            ">
                <i class="fa-solid fa-bell" style="
                    font-size: 4rem;
                    color: #3b82f6;
                    margin-bottom: 1.5rem;
                    animation: ring 1s ease-in-out infinite;
                "></i>
                <h2 style="
                    color: #e5e7eb;
                    font-size: 1.8rem;
                    margin-bottom: 1rem;
                    font-weight: 600;
                ">¿Activar Notificaciones?</h2>
                <p style="
                    color: #9ca3af;
                    font-size: 1rem;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                ">
                    Recibe alertas instantáneas cuando se publiquen nuevos trabajos, 
                    archivos o anuncios importantes. Las notificaciones llegarán 
                    incluso cuando no estés en la página.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="btn-permitir-notif" style="
                        padding: 1rem 2rem;
                        background: linear-gradient(135deg, #3b82f6, #2563eb);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
                    ">
                        <i class="fa-solid fa-check"></i> Sí, activar
                    </button>
                    <button id="btn-cancelar-notif" style="
                        padding: 1rem 2rem;
                        background: transparent;
                        color: #9ca3af;
                        border: 1px solid #2a2a2a;
                        border-radius: 10px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">
                        <i class="fa-solid fa-times"></i> Ahora no
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Agregar animación de campana
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ring {
                0%, 100% { transform: rotate(0deg); }
                10%, 30% { transform: rotate(-10deg); }
                20%, 40% { transform: rotate(10deg); }
            }
        `;
        document.head.appendChild(style);
        
        document.getElementById('btn-permitir-notif').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        
        document.getElementById('btn-cancelar-notif').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

// ============================================
// REGISTRAR TOKEN FCM EN FIREBASE
// ============================================
async function registrarTokenFCM() {
    try {
        if (!messaging) {
            console.error('Firebase Messaging no está inicializado');
            return;
        }

        // Registrar service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registrado:', registration);

        // Obtener token FCM
        const currentToken = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (currentToken) {
            console.log('Token FCM obtenido:', currentToken);
            
            // Guardar token en Firebase asociado al código del usuario
            const authData = localStorage.getItem('eduspace_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                const { codigo, deviceFingerprint } = parsed;
                
                // Buscar el dispositivo en Firebase
                const codigoRef = database.ref(`codigos/${codigo}/dispositivos`);
                const snapshot = await codigoRef.once('value');
                const dispositivos = snapshot.val() || {};
                
                const dispositivoId = Object.keys(dispositivos).find(
                    key => dispositivos[key].fingerprint === deviceFingerprint
                );
                
                if (dispositivoId) {
                    // Guardar token FCM en el dispositivo
                    await database.ref(`codigos/${codigo}/dispositivos/${dispositivoId}/fcmToken`).set(currentToken);
                    console.log('Token FCM guardado en Firebase');
                }
            }
            
        } else {
            console.log('No se pudo obtener el token FCM');
        }
        
    } catch (error) {
        console.error('Error registrando token FCM:', error);
    }
}

// ============================================
// MANEJAR NOTIFICACIONES EN PRIMER PLANO
// ============================================
if (messaging) {
    messaging.onMessage((payload) => {
        console.log('Mensaje recibido en primer plano:', payload);
        
        const notificationTitle = payload.notification.title || 'EduSpace';
        const notificationOptions = {
            body: payload.notification.body || 'Nueva actualización',
            icon: payload.notification.icon || '/icon-192.png',
            badge: '/badge-72.png',
            tag: payload.data?.tag || 'eduspace-notification',
            requireInteraction: true,
            data: payload.data
        };
        
        // Mostrar notificación del navegador
        if (Notification.permission === 'granted') {
            new Notification(notificationTitle, notificationOptions);
        }
        
        // Mostrar notificación in-app
        mostrarNotificacionInApp(payload);
        
        // Actualizar badge de trabajos pendientes
        if (payload.data?.type === 'nuevo_trabajo') {
            updatePendingBadge();
            // Recargar trabajos si está en esa pestaña
            if (currentTab === 'trabajos') {
                renderAssignments();
            }
        }
    });
}

// ============================================
// NOTIFICACIÓN IN-APP (DENTRO DE LA PÁGINA)
// ============================================
function mostrarNotificacionInApp(payload) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(59, 130, 246, 0.5);
        display: flex;
        align-items: start;
        gap: 15px;
        max-width: 400px;
        z-index: 9999;
        animation: slideInRight 0.5s ease;
        cursor: pointer;
    `;
    
    const iconMap = {
        'nuevo_trabajo': 'fa-clipboard-list',
        'nuevo_archivo': 'fa-file-lines',
        'nuevo_recurso': 'fa-book',
        'anuncio': 'fa-bullhorn'
    };
    
    const icon = iconMap[payload.data?.type] || 'fa-bell';
    
    notif.innerHTML = `
        <i class="fa-solid ${icon}" style="font-size: 2rem; flex-shrink: 0;"></i>
        <div style="flex: 1;">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 600;">
                ${payload.notification.title}
            </h4>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.95; line-height: 1.4;">
                ${payload.notification.body}
            </p>
        </div>
        <button onclick="this.parentElement.remove()" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        ">×</button>
    `;
    
    // Click para ir a la sección correspondiente
    notif.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON') {
            if (payload.data?.type === 'nuevo_trabajo') {
                switchTab('trabajos');
            } else if (payload.data?.type === 'nuevo_archivo') {
                switchTab('repositorio');
            } else if (payload.data?.type === 'nuevo_recurso') {
                switchTab('recursos');
            }
            notif.remove();
        }
    };
    
    document.body.appendChild(notif);
    
    // Auto-remover después de 10 segundos
    setTimeout(() => {
        if (notif.parentElement) {
            notif.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notif.remove(), 500);
        }
    }, 10000);
}

// ============================================
// FUNCIÓN AUXILIAR PARA MOSTRAR NOTIFICACIONES DE ÉXITO
// ============================================
function mostrarNotificacionExito(mensaje) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #0d9668);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        z-index: 9999;
        animation: slideInRight 0.5s ease;
    `;
    notif.innerHTML = `
        <i class="fa-solid fa-check-circle" style="font-size: 1.5rem;"></i>
        <span>${mensaje}</span>
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => notif.remove(), 500);
    }, 5000);
}

let filesDB = [];
let assignmentsDB = [];
let recursosDB = [];

// ============================================
// LISTENERS EN TIEMPO REAL PARA DATOS
// ============================================

// Listener para archivos
database.ref('archivos').on('value', (snapshot) => {
    const archivos = snapshot.val();
    
    if (archivos) {
        filesDB = Object.keys(archivos).map(key => ({
            id: archivos[key].id,
            title: archivos[key].title,
            area: archivos[key].area,
            teacher: archivos[key].teacher,
            date: archivos[key].date,
            type: archivos[key].type,
            urlView: archivos[key].urlView,
            urlDownload: archivos[key].urlDownload
        }));
    } else {
        filesDB = [];
    }
    
    // Renderizar si estamos en la pestaña de repositorio
    if (currentTab === 'repositorio') {
        renderFiles(currentFilter);
    }
});

// Listener para trabajos
database.ref('trabajos').on('value', (snapshot) => {
    const trabajos = snapshot.val();
    
    if (trabajos) {
        assignmentsDB = Object.keys(trabajos).map(key => ({
            id: trabajos[key].id,
            task: trabajos[key].task,
            teacher: trabajos[key].teacher,
            deadline: trabajos[key].deadline,
            status: trabajos[key].status,
            description: trabajos[key].description,
            requirements: trabajos[key].requirements || [],
            attachments: trabajos[key].attachments || []
        }));
    } else {
        assignmentsDB = [];
    }
    
    // Actualizar badge y renderizar si estamos en trabajos
    updatePendingBadge();
    if (currentTab === 'trabajos') {
        if (showingFinalizados) {
            renderFinalizados();
        } else {
            renderAssignments();
        }
    }
});

// Listener para recursos
database.ref('recursos').on('value', (snapshot) => {
    const recursos = snapshot.val();
    
    if (recursos) {
        recursosDB = Object.keys(recursos).map(key => ({
            id: recursos[key].id,
            title: recursos[key].title,
            description: recursos[key].description,
            type: recursos[key].type,
            urlView: recursos[key].urlView,
            urlDownload: recursos[key].urlDownload
        }));
    } else {
        recursosDB = [];
    }
    
    // Renderizar si estamos en la pestaña de recursos
    if (currentTab === 'recursos') {
        renderRecursos();
    }
});


// Listener para profesores
database.ref('profesores').on('value', (snapshot) => {
    const profesores = snapshot.val();
    
    if (profesores) {
        // Convertir objeto de Firebase a formato teachersDB
        teachersDB = {};
        Object.values(profesores).forEach(prof => {
            teachersDB[prof.name] = {
                name: prof.name,
                title: prof.title,
                photo: prof.photo,
                email: prof.email,
                phone: prof.phone
            };
        });
    }
    
    if (currentTab === 'docentes') {
        renderDocentes();
    }
});

// Listener para estudiantes
database.ref('estudiantes').on('value', (snapshot) => {
    const estudiantes = snapshot.val();
    
    if (estudiantes) {
        studentsDB = Object.values(estudiantes);
    } else {
        studentsDB = [];
    }
    
    if (currentTab === 'estudiantes') {
        renderEstudiantes();
    }
});
