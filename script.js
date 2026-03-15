// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================
const firebaseConfig = { 
    apiKey: "AIzaSyBKiq_t-gZj_l1Bzj9Y1Jpft03b60pyyuQ",
    authDomain: "eduspace-auth-d7577.firebaseapp.com",
    databaseURL: "https://eduspace-auth-d7577-default-rtdb.firebaseio.com",
    projectId: "eduspace-auth-d7577",
    storageBucket: "eduspace-auth-d7577.firebasestorage.app",
    messagingSenderId: "49398558176",
    appId: "1:49398558176:web:e1c5f750543d5a4d6b4f85"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth     = firebase.auth();

// ============================================
// TIPO DE DISPOSITIVO
// ============================================
function getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'mobile';
    if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android.*mobile/i.test(ua)) return 'mobile';
    return 'desktop';
}

function _getOrCreateInstanceId() {
    let id = localStorage.getItem('eduspace_instance_id');
    if (!id) {
        id = 'inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('eduspace_instance_id', id);
    }
    return id;
}


// ============================================
// ESTADO UI
// ============================================
let _loaderAnimFrame = null;

function showConnectionLoader() {
    const el = document.getElementById('connectionLoader');
    if (el) el.style.display = 'flex';
    const dm = document.getElementById('displacement-map');
    if (!dm) return;
  
  
    let t = 0;
    function loop() {
        t += 0.10;
        dm.setAttribute('scale', 15 + Math.sin(t * 2) * 1.5);
        _loaderAnimFrame = requestAnimationFrame(loop);
    }
    loop();
}

function hideConnectionLoader() {
    const el = document.getElementById('connectionLoader');
    if (el) el.style.display = 'none';
    if (_loaderAnimFrame) {
        cancelAnimationFrame(_loaderAnimFrame);
        _loaderAnimFrame = null;
    }
}
function showAuthModal() {
    const el = document.getElementById('authModal');
    if (el) el.style.display = 'flex';
}
function hideAuthModal() {
    const el = document.getElementById('authModal');
    if (el) el.style.display = 'none';
}

// ============================================
// SESSION STORAGE — VALIDACIÓN TEMPORAL
// ============================================
const _TV_KEY = '_cdsk_tv';
let _registrandoAhora = false;

function _getTempValidacion() {
    try {
        const raw = sessionStorage.getItem(_TV_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function _setTempValidacion(val) {
    try {
        if (val !== null && val !== undefined) {
            sessionStorage.setItem(_TV_KEY, JSON.stringify(val));
        } else {
            sessionStorage.removeItem(_TV_KEY);
        }
    } catch(e) { console.error('sessionStorage error:', e); }
}

// ============================================
// HELPERS — OCULTAR TODOS LOS STEPS
// ============================================
function _ocultarTodosLosSteps() {
    const ids = [
        'auth-step-code', 'auth-step-registro', 'auth-step-google',
        'auth-step-api-reveal', 'auth-step-laptop', 'auth-step-google-laptop',
        'auth-step-no-registrado'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// ============================================
// FLUJO MÓVIL: PASOS
// ============================================

// ── PASO 1: Solo muestra el botón de Google ──
function mostrarPaso1() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-code').style.display = 'block';
    const errEl = document.getElementById('authError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const btn = document.getElementById('googleSignInBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
}

function mostrarPasoRegistro() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-registro').style.display = 'block';
    const errReg = document.getElementById('authRegistroError');
    if (errReg) { errReg.textContent = ''; errReg.style.display = 'none'; }
    resetImagePreview();
    selectedImageFile = null; selectedImageDataUrl = ''; selectedEspecialidad = ''; selectedCiclo = '';
}

function mostrarPaso2Google() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-google').style.display = 'block';
    const errGoogle = document.getElementById('googleError');
    if (errGoogle) { errGoogle.style.display = 'none'; errGoogle.textContent = ''; }
    const btn = document.getElementById('googleSignInBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
    const tempVal = _getTempValidacion();
    if (tempVal) {
        const infoEl = document.getElementById('auth-codigo-validado');
        if (infoEl) infoEl.textContent = `✅ Código "${tempVal.codigo}" verificado. Ahora vincula tu cuenta de Google.`;
    }
}

function mostrarPasoApiReveal(nombre, api) {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-api-reveal').style.display = 'block';
    const saludoEl = document.getElementById('apiRevealSaludo');
    const numEl    = document.getElementById('apiRevealNumber');
    if (saludoEl) saludoEl.textContent = `Hola, ${nombre} 👋`;
    if (numEl)    numEl.textContent    = String(api);
}

function finalizarRegistroMobile() {
    hideAuthModal();
    actualizarPerfilSidebar();
}

// ============================================
// FLUJO LAPTOP: PASOS
// ============================================
function mostrarPasoLaptop() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-laptop').style.display = 'block';
    const errEl = document.getElementById('laptopApiError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const btn = document.getElementById('laptopApiSubmit');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; }
    const input = document.getElementById('laptopApiInput');
    if (input) input.value = '';
}

async function validarAPI() {
    const apiInput = document.getElementById('laptopApiInput').value.trim();
    const errEl    = document.getElementById('laptopApiError');
    const btn      = document.getElementById('laptopApiSubmit');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (!apiInput) { if (errEl) { errEl.textContent = '⚠️ Por favor ingresa tu API numérica.'; errEl.style.display = 'block'; } return; }
    if (!/^\d+$/.test(apiInput)) { if (errEl) { errEl.textContent = '⚠️ El API debe ser un número (solo dígitos).'; errEl.style.display = 'block'; } return; }
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    try {
        const snapshot = await database.ref('codigos').once('value');
        const codigos  = snapshot.val();
        if (!codigos) { if (errEl) { errEl.textContent = '❌ API no encontrada. Verifica el número.'; errEl.style.display = 'block'; } btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return; }
        let codigoEncontrado = null, codigoKey = null;
        for (const [key, data] of Object.entries(codigos)) {
            if (data.api && String(data.api) === String(apiInput)) { codigoEncontrado = data; codigoKey = key; break; }
        }
        if (!codigoEncontrado) { if (errEl) { errEl.textContent = '❌ API no encontrada. Verifica el número.'; errEl.style.display = 'block'; } btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return; }
        if (codigoEncontrado.bloqueado === true) { if (errEl) { errEl.textContent = `🚫 ACCESO BLOQUEADO: ${codigoEncontrado.motivoBloqueo || 'Tu acceso ha sido bloqueado.'}`; errEl.style.display = 'block'; } btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return; }
        const dispositivos = codigoEncontrado.dispositivos || {};
        const mobileDevice = Object.values(dispositivos).find(d => d.tipo === 'mobile');
        if (!mobileDevice) { if (errEl) { errEl.textContent = '📱 Primero debes registrarte desde tu dispositivo móvil con este código.'; errEl.style.display = 'block'; } btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return; }
        if (!codigoEncontrado.api) { if (errEl) { errEl.textContent = '❌ Este código no tiene API asignada. Contacta al administrador.'; errEl.style.display = 'block'; } btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return; }
        const userName = codigoEncontrado.perfil?.nombre || mobileDevice.usuario || '';
        _setTempValidacion({ api: apiInput, codigo: codigoKey, codigoData: codigoEncontrado, userName, requiredGoogleUid: mobileDevice.googleUid });
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
        mostrarPasoGoogleLaptop();
    } catch (error) {
        console.error('Error validando API:', error);
        if (errEl) { errEl.textContent = '❌ Error de conexión. Intenta nuevamente.'; errEl.style.display = 'block'; }
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

function mostrarPasoGoogleLaptop() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-google-laptop').style.display = 'block';
    const tempVal = _getTempValidacion();
    const infoEl  = document.getElementById('auth-api-validado');
    if (infoEl && tempVal) infoEl.textContent = `✅ API verificada · Bienvenido, ${tempVal.userName}.`;
    const errEl = document.getElementById('googleErrorLaptop');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const btn = document.getElementById('googleSignInBtnLaptop');
    if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
}

async function signInWithGoogleLaptop() {
    const btn   = document.getElementById('googleSignInBtnLaptop');
    const errEl = document.getElementById('googleErrorLaptop');
    if (!_getTempValidacion()) { if (errEl) { errEl.textContent = '⚠️ Error interno. Recarga e intenta de nuevo.'; errEl.style.display = 'block'; } return; }
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
    if (errEl) errEl.style.display = 'none';
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        _registrandoAhora = true;
        const result = await auth.signInWithPopup(provider);
        await completarRegistroLaptop(result.user);
    } catch (error) {
        console.error('Error Google Laptop Sign-In:', error);
        let mensaje = '❌ Error al iniciar sesión. Intenta nuevamente.';
        if (error.code === 'auth/popup-closed-by-user') mensaje = '⚠️ Cerraste la ventana de Google. Intenta nuevamente.';
        if (error.code === 'auth/popup-blocked')         mensaje = '⚠️ Permite las ventanas emergentes e intenta de nuevo.';
        if (errEl) { errEl.textContent = mensaje; errEl.style.display = 'block'; }
        btn.disabled = false; btn.innerHTML = googleBtnHTML();
    } finally { _registrandoAhora = false; }
}

async function completarRegistroLaptop(user) {
    const tempVal = _getTempValidacion();
    if (!tempVal) { console.warn('completarRegistroLaptop sin datos temp.'); await auth.signOut().catch(console.error); showAuthModal(); mostrarPasoLaptop(); return; }
    const { codigo, userName, requiredGoogleUid } = tempVal;
    const googleUid = user.uid;
    const deviceKey = `${googleUid}_desktop`;
    const errEl = document.getElementById('googleErrorLaptop');
    const btn   = document.getElementById('googleSignInBtnLaptop');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...'; }
    if (errEl) errEl.style.display = 'none';
    try {
        const snapshot  = await database.ref(`codigos/${codigo}`).once('value');
        const freshData = snapshot.val();
        if (!freshData) { await _cerrarSesionLaptopYMostrarError('❌ El código ya no existe en el sistema.', errEl, btn); return; }
        if (freshData.bloqueado === true) { await _cerrarSesionLaptopYMostrarError(`🚫 ACCESO BLOQUEADO: ${freshData.motivoBloqueo || 'Acceso bloqueado.'}`, errEl, btn); return; }
        if (googleUid !== requiredGoogleUid) { await _cerrarSesionLaptopYMostrarError('🚫 La cuenta de Google ingresada no pertenece al propietario de este API. Debes usar la misma cuenta de Google con la que te registraste en el móvil.', errEl, btn); return; }
        const dispositivos = freshData.dispositivos || {};
        if (dispositivos[deviceKey]) {
            await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`).set(new Date().toISOString());
            await _cargarPerfilDesdeFirebase(freshData, userName);
            _guardarSesionLocal(userName, codigo, googleUid, 'desktop');
            _setTempValidacion(null); hideAuthModal();
if (codigo === '6578hy') showSpecialUserMessage();
iniciarListenerBloqueo(); iniciarListenerSupabaseRegistered(); iniciarListenerFotoPerfil();
actualizarPerfilSidebar(); return;
}
const desktopCount = Object.values(dispositivos).filter(d => d.tipo === 'desktop').length;
if (desktopCount >= 1) { await _cerrarSesionLaptopYMostrarError('💻 Este código ya tiene una laptop registrada. Solo se permite 1 laptop por código.', errEl, btn); return; }
const updates = {};
updates[`codigos/${codigo}/dispositivos/${deviceKey}`] = { googleUid, googleEmail: user.email, tipo: 'desktop', usuario: userName, instanceId: _getOrCreateInstanceId(), fechaRegistro: new Date().toISOString(), ultimoAcceso: new Date().toISOString() };
await database.ref().update(updates);
await _cargarPerfilDesdeFirebase(freshData, userName);
_guardarSesionLocal(userName, codigo, googleUid, 'desktop');
_setTempValidacion(null); hideAuthModal();
if (codigo === '6578hy') showSpecialUserMessage();
iniciarListenerBloqueo(); iniciarListenerSupabaseRegistered(); iniciarListenerFotoPerfil();
actualizarPerfilSidebar();
} catch (error) {
        console.error('Error en completarRegistroLaptop:', error);
        if (btn)   { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
    }
}


async function _cargarPerfilDesdeFirebase(codigoData, userName) {
    const perfil = codigoData.perfil;
    let profileData;
    if (perfil && perfil.foto_url) {
        profileData = {
            nombre:              perfil.nombre              || userName,
            especialidad:        perfil.especialidad        || codigoData.especialidad || '',
            ciclo:               perfil.ciclo               || codigoData.ciclo        || '',
            foto_url:            perfil.foto_url,
            supabase_registered: perfil.supabase_registered === true,
            fecha_registro:      perfil.fecha_registro || ''
        };
    } else {
        profileData = {
            nombre:              perfil?.nombre             || userName,
            especialidad:        perfil?.especialidad       || codigoData.especialidad || '',
            ciclo:               perfil?.ciclo              || codigoData.ciclo        || '',
            foto_url:            '',
            supabase_registered: perfil?.supabase_registered === true || false,
            fecha_registro:      perfil?.fecha_registro || ''
        };
    }
    localStorage.setItem('eduspace_student_profile', JSON.stringify(profileData));
}

async function _savePerfilToFirebase(codigo, perfil) {
    if (!codigo) return;
    try {
        await database.ref(`codigos/${codigo}/perfil`).set({
            nombre:              perfil.nombre              || '',
            especialidad:        perfil.especialidad        || '',
            ciclo:               perfil.ciclo               || '',
            foto_url:            perfil.foto_url            || '',
            supabase_registered: perfil.supabase_registered || false,
            fecha_registro:      perfil.fecha_registro      || ''
        });
    } catch(e) { console.error('Error guardando perfil en Firebase:', e); }
}

function googleBtnHTML() {
    return `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg> Continuar con Google`;
}

// ============================================
// NUEVA AUTENTICACIÓN — GOOGLE + EMAIL PANEL
// ============================================

async function signInWithGoogle() {
    const btn   = document.getElementById('googleSignInBtn');
    const errEl = document.getElementById('authError');
    if (errEl) errEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        _registrandoAhora = true;
        const result = await auth.signInWithPopup(provider);
        await procesarLoginGoogle(result.user);
    } catch (error) {
        let mensaje = '❌ Error al iniciar sesión con Google.';
        if (error.code === 'auth/popup-closed-by-user') mensaje = '⚠️ Cerraste la ventana de Google.';
        if (error.code === 'auth/popup-blocked')         mensaje = '⚠️ Permite las ventanas emergentes.';
        if (errEl) { errEl.textContent = mensaje; errEl.style.display = 'block'; }
        btn.disabled = false; btn.innerHTML = googleBtnHTML();
    } finally { _registrandoAhora = false; }
}

async function buscarCodigoPorEmail(email) {
    const snap = await database.ref('codigos').once('value');
    const codigos = snap.val() || {};
    for (const [key, data] of Object.entries(codigos)) {
        if (data.email && data.email.toLowerCase() === email.toLowerCase()) {
            return { codigoKey: key, ...data };
        }
    }
    return null;
}

async function procesarLoginGoogle(user) {
    const errEl = document.getElementById('authError');
    const btn   = document.getElementById('googleSignInBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...'; }

    try {
        const codigoEncontrado = await buscarCodigoPorEmail(user.email);

        if (!codigoEncontrado) {
            try {
                const u = auth.currentUser;
                if (u) await u.delete();
            } catch(e) { await auth.signOut().catch(console.error); }
           if (errEl) {
    errEl.innerHTML = '🚫 Tu cuenta de Google no está registrada en el sistema. <span class="saber-mas-link" onclick="mostrarSaberMas()">Saber más</span>';
    errEl.style.display = 'block';
}
            if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
            return;
        }

        if (codigoEncontrado.bloqueado === true) {
            try {
                const u = auth.currentUser;
                if (u) await u.delete();
            } catch(e) { await auth.signOut().catch(console.error); }
            if (errEl) {
                errEl.textContent = `🚫 ACCESO BLOQUEADO: ${codigoEncontrado.motivoBloqueo || 'Tu acceso ha sido bloqueado.'}`;
                errEl.style.display = 'block';
            }
            if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
            return;
        }

        const codigo     = codigoEncontrado.codigoKey;
        const nombre     = codigoEncontrado.propietario || '';
        const esp        = codigoEncontrado.especialidad || '';
        const ciclo      = codigoEncontrado.ciclo || '';
        const apiNum     = codigoEncontrado.api || '';
        const googleUid  = user.uid;
        const deviceType = getDeviceType();
        const deviceKey  = `${googleUid}_${deviceType}`;

        _guardarSesionLocal(nombre, codigo, googleUid, deviceType);
        _setTempValidacion({ userName: nombre, codigo, codigoData: codigoEncontrado });

        const dispositivos         = codigoEncontrado.dispositivos || {};
        const instanceId           = _getOrCreateInstanceId();
        const dispositivoExistente = dispositivos[deviceKey];

       

        if (!dispositivoExistente) {
            await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}`).set({
                googleUid,
                googleEmail: user.email,
                tipo: deviceType,
                usuario: nombre,
                instanceId,
                fechaRegistro: new Date().toISOString(),
                ultimoAcceso: new Date().toISOString()
            });
        } else {
            await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}`).update({
                instanceId,
                ultimoAcceso: new Date().toISOString()
            });
        }

        const perfilExistente  = localStorage.getItem('eduspace_student_profile');
        const perfilEnFirebase = codigoEncontrado.perfil?.nombre;

      if (perfilExistente || perfilEnFirebase) {
            if (perfilEnFirebase && !perfilExistente) {
                await _cargarPerfilDesdeFirebase(codigoEncontrado, nombre);
            }
            const perfilSyncRaw = localStorage.getItem('eduspace_student_profile');
            if (perfilSyncRaw) {
                const perfilSync = JSON.parse(perfilSyncRaw);
                let cambio = false;
                if (!perfilSync.especialidad && esp)   { perfilSync.especialidad = esp;   cambio = true; }
                if (!perfilSync.ciclo        && ciclo) { perfilSync.ciclo        = ciclo; cambio = true; }
                if (cambio) localStorage.setItem('eduspace_student_profile', JSON.stringify(perfilSync));
            }
            if (apiNum && deviceType === 'mobile') localStorage.setItem('eduspace_api', String(apiNum));
            _setTempValidacion(null);
            hideAuthModal();
            if (codigo === '6578hy') showSpecialUserMessage();
            iniciarListenerBloqueo();
iniciarListenerSupabaseRegistered();
iniciarListenerFotoPerfil();
actualizarPerfilSidebar();
return;
        }

        mostrarPasoRegistroNuevo(nombre, esp, ciclo, apiNum);

    } catch (error) {
        console.error('Error en procesarLoginGoogle:', error);
        if (errEl) { errEl.textContent = '❌ Error de conexión. Intenta nuevamente.'; errEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
    }
}

function mostrarPasoRegistroNuevo(nombre, especialidad, ciclo, api) {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-registro').style.display = 'block';

    const inputNombre = document.getElementById('reg-nombre');
    const inputEsp    = document.getElementById('reg-especialidad');
    const inputCiclo  = document.getElementById('reg-ciclo');
    if (inputNombre) inputNombre.value = nombre;
    if (inputEsp)    inputEsp.value    = especialidad;
    if (inputCiclo)  inputCiclo.value  = ciclo ? `Ciclo ${ciclo}` : '—';

    selectedEspecialidad = especialidad;
    selectedCiclo        = ciclo;

    const apiWrapper = document.getElementById('reg-api-wrapper');
    const apiNumEl   = document.getElementById('reg-api-number');
    if (api && getDeviceType() === 'mobile' && apiWrapper && apiNumEl) {
        apiWrapper.style.display = 'block';
        apiNumEl.textContent     = api;
        localStorage.setItem('eduspace_api', String(api));
    }

    aplicarTemaEspecialidad(especialidad);

    resetImagePreview();
    selectedImageFile = null; selectedImageDataUrl = '';
}

async function continuarDesdeAuth() {
    const errEl  = document.getElementById('authRegistroError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    const tempVal = _getTempValidacion();
    if (!tempVal) { mostrarPaso1(); return; }

    const { userName, codigo, codigoData } = tempVal;
    const user = auth.currentUser;
    if (!user) { mostrarPaso1(); return; }

    const apiNum = codigoData.api || '';

    const btn = document.querySelector('#auth-step-registro .auth-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

    try {
        let fotoUrl = '';
        if (selectedImageFile) {
            const formData = new FormData();
            formData.append('file', selectedImageFile);
            formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
            formData.append('folder', 'estudiantes_clouddesk');
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
            if (res.ok) { const data = await res.json(); fotoUrl = data.secure_url; }
        }

        const perfil = {
            nombre:              userName,
            especialidad:        selectedEspecialidad,
            ciclo:               selectedCiclo,
            foto_url:            fotoUrl,
            supabase_registered: false,
            fecha_registro:      ''
        };
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));
        if (codigo) await _savePerfilToFirebase(codigo, perfil);

        if (apiNum && getDeviceType() === 'mobile') localStorage.setItem('eduspace_api', String(apiNum));

        _setTempValidacion(null);
        hideAuthModal();
        if (codigo === '6578hy') showSpecialUserMessage();
        iniciarListenerBloqueo();
iniciarListenerSupabaseRegistered();
iniciarListenerFotoPerfil();
actualizarPerfilSidebar();

    } catch(err) {
        console.error(err);
        if (errEl) { errEl.textContent = '❌ Error al guardar. Intenta de nuevo.'; errEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Entrar'; }
    }
}

function normalizarNombre(nombre) {
    return nombre.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

// ============================================
// GUARDAR SESIÓN LOCAL
// ============================================
function _guardarSesionLocal(userName, codigo, googleUid, deviceType) {
    const authData = { userName, codigo, googleUid, deviceType, timestamp: Date.now() };
    localStorage.setItem('eduspace_auth', JSON.stringify(authData));
}

// ============================================
// VALIDAR AUTH CON FIREBASE
// ============================================
async function validateAuthWithFirebase(googleUid) {
    try {
        const authData = localStorage.getItem('eduspace_auth');
        if (!authData) return false;
        const parsed = JSON.parse(authData);
        const { codigo, userName } = parsed;
        if (parsed.googleUid !== googleUid) { localStorage.removeItem('eduspace_auth'); return false; }

        // Verificar que el email sigue siendo válido en el sistema
        const user = auth.currentUser;
        if (user?.email) {
            const codigoDelEmail = await buscarCodigoPorEmail(user.email);
            if (!codigoDelEmail || codigoDelEmail.codigoKey !== codigo) {
                localStorage.removeItem('eduspace_auth'); return false;
            }
        }

        const snapshot   = await database.ref(`codigos/${codigo}`).once('value');
        const codigoData = snapshot.val();
        if (!codigoData) { localStorage.removeItem('eduspace_auth'); return false; }
        if (codigoData.bloqueado === true) { localStorage.removeItem('eduspace_auth'); return false; }
        return true;
    } catch(e) {
        console.error('Error validateAuthWithFirebase:', e);
        return false;
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
let _appInicializada = false;
let _authValidating = false;

document.addEventListener('DOMContentLoaded', async () => {
    showConnectionLoader();

    // Laptop: input API
    if (getDeviceType() === 'desktop') {
        document.getElementById('laptopApiInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validarAPI();
        });
    }

    auth.onAuthStateChanged(async (user) => {
        if (_authValidating) { hideConnectionLoader(); return; }
        _authValidating = true;
        hideConnectionLoader();

        if (user) {
            const authData = localStorage.getItem('eduspace_auth');
            if (authData) {
                const ok = await validateAuthWithFirebase(user.uid);
                if (ok) {
                    const apiRevealStep = document.getElementById('auth-step-api-reveal');
                    if (!apiRevealStep || apiRevealStep.style.display === 'none') hideAuthModal();
                    iniciarListenerBloqueo();
iniciarListenerSupabaseRegistered();
iniciarListenerFotoPerfil();
actualizarPerfilSidebar();
                } else {
                    showAuthModal(); getDeviceType() === 'mobile' ? mostrarPaso1() : mostrarPasoLaptop();
                }
            } else {
                if (_registrandoAhora) { _authValidating = false; return; }
                await auth.signOut().catch(console.error);
                showAuthModal(); getDeviceType() === 'mobile' ? mostrarPaso1() : mostrarPasoLaptop();
            }
        } else {
            showAuthModal(); getDeviceType() === 'mobile' ? mostrarPaso1() : mostrarPasoLaptop();
        }

        if (!_appInicializada) {
            _appInicializada = true; updatePendingBadge(); actualizarPerfilSidebar(); switchTab('repositorio');
        }
        setTimeout(() => { _authValidating = false; }, 4000);
    });

    const checkbox = document.getElementById('aceptoTerminos');
    if (checkbox) {
        checkbox.addEventListener('change', function() {
            const formRegistro      = document.getElementById('form-registro');
            const terminosContainer = document.querySelector('.terminos-container');
            if (this.checked) {
                const perfil   = JSON.parse(localStorage.getItem('eduspace_student_profile') || '{}');
                const authData = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');
                const inputNombre = document.getElementById('nombreCompleto');
                if (inputNombre) inputNombre.value = perfil.nombre || authData.userName || '';
                const dispEsp   = document.getElementById('displayEspecialidad');
                const dispCiclo = document.getElementById('displayCiclo');
                if (dispEsp)   dispEsp.textContent   = perfil.especialidad || '—';
                if (dispCiclo) dispCiclo.textContent = perfil.ciclo ? `Ciclo ${perfil.ciclo}` : '—';
               const fotoConfirm = document.getElementById('fotoConfirmacion');
const uploadArea  = document.getElementById('reg-foto-upload-area');
const cambiarBtn  = document.getElementById('reg-foto-cambiar-btn');
const tieneFoto   = !!(perfil.foto_url && perfil.foto_url.trim() !== '');
registroFotoFile  = null;
if (fotoConfirm) {
    if (tieneFoto) {
        fotoConfirm.src          = perfil.foto_url;
        fotoConfirm.style.display = 'block';
        if (uploadArea) uploadArea.style.display = 'none';
        if (cambiarBtn) cambiarBtn.style.display = 'flex';
    } else {
        fotoConfirm.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'flex';
        if (cambiarBtn) cambiarBtn.style.display = 'none';
    }
}
                terminosContainer.style.transition = 'opacity .3s ease, transform .3s ease';
                terminosContainer.style.opacity    = '0';
                terminosContainer.style.transform  = 'translateY(-20px)';
                setTimeout(() => {
                    terminosContainer.style.display = 'none'; formRegistro.style.display = 'block';
                    formRegistro.style.opacity = '0'; formRegistro.style.transform = 'translateY(20px)';
                    setTimeout(() => { formRegistro.style.transition = 'opacity .3s ease, transform .3s ease'; formRegistro.style.opacity = '1'; formRegistro.style.transform = 'translateY(0)'; }, 10);
                }, 300);
            } else {
                formRegistro.style.opacity = '0'; formRegistro.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    formRegistro.style.display = 'none'; terminosContainer.style.display = 'block';
                    terminosContainer.style.opacity = '0'; terminosContainer.style.transform = 'translateY(-20px)';
                    setTimeout(() => { terminosContainer.style.opacity = '1'; terminosContainer.style.transform = 'translateY(0)'; }, 10);
                }, 300);
            }
        });
    }
});

// ============================================
// LISTENER DE BLOQUEO EN TIEMPO REAL
// ============================================
let bloqueoListener = null;
let supabaseRegistradoListener = null;
let fotoPerfilListener = null;

function iniciarListenerBloqueo() {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return;
    try {
        const parsed = JSON.parse(authData);
        const { codigo } = parsed;
        if (bloqueoListener) database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener);
        let primeraLlamada = true;
        bloqueoListener = database.ref(`codigos/${codigo}/bloqueado`).on('value', (snapshot) => {
            if (primeraLlamada) { primeraLlamada = false; return; }
            const estaBloqueado = snapshot.val();
            if (estaBloqueado === true) {
                database.ref(`codigos/${codigo}/motivoBloqueo`).once('value', async (motivoSnapshot) => {
                    const motivo = motivoSnapshot.val() || 'Tu acceso ha sido bloqueado por el administrador.';
                    await auth.signOut().catch(e => console.error(e));
                    localStorage.removeItem('eduspace_auth'); _setTempValidacion(null);
                  
                showAuthModal(); mostrarPaso1();
                    const errorDiv = document.getElementById('authError');
                    if (errorDiv) { errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`; errorDiv.style.display = 'block'; }
                    hideSpecialUserMessage();
                });
            } else if (estaBloqueado === false) {
                const authDataNow = localStorage.getItem('eduspace_auth');
                const user        = auth.currentUser;
                if (authDataNow && user) {
                    validateAuthWithFirebase(user.uid).then(isValid => {
                        if (isValid) {
                            hideAuthModal();
                            const parsed2 = JSON.parse(authDataNow);
                            if (parsed2.codigo === '6578hy') showSpecialUserMessage();
                            mostrarNotificacionDesbloqueo();
                        }
                    });
                }
            }
        });
    } catch(e) { console.error('Error iniciando listener de bloqueo:', e); }
}

// ============================================
// LISTENER SUPABASE_REGISTERED EN TIEMPO REAL
// ============================================
function iniciarListenerSupabaseRegistered() {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return;
    try {
        const parsed = JSON.parse(authData);
        const { codigo } = parsed;
        if (supabaseRegistradoListener) {
            database.ref(`codigos/${codigo}/perfil/supabase_registered`).off('value', supabaseRegistradoListener);
        }
        supabaseRegistradoListener = database.ref(`codigos/${codigo}/perfil/supabase_registered`).on('value', (snapshot) => {
            const estaRegistrado = snapshot.val();
            if (estaRegistrado === true) {
                const perfilLocal = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
                if (perfilLocal && !perfilLocal.supabase_registered) {
                    perfilLocal.supabase_registered = true;
                    localStorage.setItem('eduspace_student_profile', JSON.stringify(perfilLocal));
                }
                const btnRegistrarme = document.getElementById('btn-registrarme');
                if (btnRegistrarme) btnRegistrarme.style.display = 'none';
                actualizarEncabezadoEstudiantes();
            }
        });
    } catch(e) { console.error('Error listener supabase_registered:', e); }
}

function iniciarListenerFotoPerfil() {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return;
    try {
        const parsed = JSON.parse(authData);
        const { codigo } = parsed;
        if (fotoPerfilListener) {
            database.ref(`codigos/${codigo}/perfil/foto_url`).off('value', fotoPerfilListener);
        }
        fotoPerfilListener = database.ref(`codigos/${codigo}/perfil/foto_url`).on('value', (snapshot) => {
            const nuevaFoto = snapshot.val() || '';
            const perfilLocal = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
            if (!perfilLocal) return;
            if (nuevaFoto === perfilLocal.foto_url) return;
            perfilLocal.foto_url = nuevaFoto;
            localStorage.setItem('eduspace_student_profile', JSON.stringify(perfilLocal));
            actualizarPerfilSidebar();
            actualizarEncabezadoEstudiantes();
            if (currentTab === 'estudiantes') cargarEstudiantes();
        });
    } catch(e) { console.error('Error listener foto perfil:', e); }
}

function mostrarNotificacionDesbloqueo() {
    const notif = document.createElement('div');
    notif.style.cssText = `position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#10b981,#0d9668);color:white;padding:1rem 1.5rem;border-radius:12px;box-shadow:0 4px 15px rgba(16,185,129,0.4);display:flex;align-items:center;gap:10px;font-weight:600;z-index:9999;animation:slideInRight 0.5s ease;`;
    notif.innerHTML = `<i class="fa-solid fa-check-circle" style="font-size:1.5rem;"></i><span>Tu acceso ha sido restaurado</span>`;
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.animation = 'slideOutRight 0.5s ease'; setTimeout(() => notif.remove(), 500); }, 5000);
}

window.addEventListener('beforeunload', () => {
    const authData = localStorage.getItem('eduspace_auth');
    if (authData) {
        try {
            const parsed = JSON.parse(authData);
            if (bloqueoListener) database.ref(`codigos/${parsed.codigo}/bloqueado`).off('value', bloqueoListener);
          if (supabaseRegistradoListener) database.ref(`codigos/${parsed.codigo}/perfil/supabase_registered`).off('value', supabaseRegistradoListener);
            if (fotoPerfilListener) database.ref(`codigos/${parsed.codigo}/perfil/foto_url`).off('value', fotoPerfilListener);
        } catch(e) { console.error(e); }
    }
});

// ============================================
// BASE DE DATOS
// ============================================
const teachersDB = {
    "Prof. Alejandro Ruiz": { name:"Prof. Alejandro Ruiz", title:"Profesor de Matemáticas",    photo:"https://i.pravatar.cc/150?img=12", email:"alejandro.ruiz@eduspace.com",  phone:"+51 987 654 321" },
    "Dra. María González":  { name:"Dra. María González",  title:"Doctora en Biológicas",       photo:"https://i.pravatar.cc/150?img=12", email:"maria.gonzalez@eduspace.com",  phone:"+51 987 654 322" },
    "Lic. Carlos Fuentes":  { name:"Lic. Carlos Fuentes",  title:"Licenciado en Literatura",    photo:"https://i.pravatar.cc/150?img=12", email:"carlos.fuentes@eduspace.com",  phone:"+51 987 654 323" },
    "Prof. Diana Prince":   { name:"Prof. Diana Prince",   title:"Profesora de Historia",       photo:"https://i.pravatar.cc/150?img=12", email:"diana.prince@eduspace.com",    phone:"+51 987 654 324" }
};

const filesDB = [
    { id:1, title:"Guía de Álgebra Avanzada",       area:"Matemáticas", teacher:"Prof. Alejandro Ruiz", date:"2025-05-10", type:"PDF",  urlView:"https://docs.google.com/document/d/1u223FM_asu6nkbkHdYPc48QyOMow7sDH/edit?usp=drive_link&ouid=110125860748103327612&rtpof=true&sd=true", urlDownload:"https://res.cloudinary.com/dwzwa3gp0/raw/upload/v1766695102/D%C3%89FICIT_DE_PROYECTO_DE_INVESTIGACI%C3%93N_mxcrj4.docx" },
    { id:2, title:"La Célula y sus partes",          area:"Ciencias",    teacher:"Dra. María González",  date:"2025-05-12", type:"PPTX", urlView:"https://docs.google.com/presentation/d/1234567890/preview", urlDownload:"https://docs.google.com/presentation/d/1234567890/export/pptx" },
    { id:3, title:"Ensayo: Realismo Mágico",         area:"Literatura",  teacher:"Lic. Carlos Fuentes",  date:"2025-05-14", type:"DOCX", urlView:"https://docs.google.com/document/d/1234567890/preview",     urlDownload:"https://docs.google.com/document/d/1234567890/export?format=docx" },
    { id:4, title:"Revolución Industrial",           area:"Historia",    teacher:"Prof. Diana Prince",    date:"2025-05-15", type:"PDF",  urlView:"https://drive.google.com/file/d/1234567890/preview",         urlDownload:"https://drive.google.com/uc?export=download&id=1234567890" },
    { id:5, title:"Ejercicios de Trigonometría",     area:"Matemáticas", teacher:"Prof. Alejandro Ruiz", date:"2025-05-18", type:"PDF",  urlView:"https://drive.google.com/file/d/0987654321/preview",         urlDownload:"https://drive.google.com/uc?export=download&id=0987654321" }
];

const assignmentsDB = [
    { id:101, task:"Informe de Laboratorio #3", teacher:"Dra. María González", deadline:"2025-05-25", status:"Pendiente", description:"Realizar un informe completo sobre el experimento de fotosíntesis realizado en clase. El informe debe incluir introducción, metodología, resultados, análisis y conclusiones.", requirements:["Mínimo 5 páginas, máximo 8 páginas","Incluir gráficos y tablas de los datos obtenidos","Referencias bibliográficas en formato APA","Análisis crítico de los resultados","Conclusiones basadas en evidencia científica"], attachments:[{ name:"Guía del Informe.pdf", size:"245 KB", type:"PDF", downloadUrl:"enlace de google drive" },{ name:"Datos del Experimento.xlsx", size:"128 KB", type:"Excel", downloadUrl:"enlace desde google drive" }] },
    { id:102, task:"Análisis de 'Cien Años de Soledad'", teacher:"Lic. Carlos Fuentes", deadline:"2025-05-20", status:"Pendiente", description:"Realizar un análisis literario profundo de la obra 'Cien Años de Soledad' de Gabriel García Márquez.", requirements:["Ensayo de 6-8 páginas","Análisis de al menos 3 personajes principales","Identificación de elementos del realismo mágico","Contexto histórico y social de la obra","Citas textuales debidamente referenciadas"], attachments:[{ name:"Rúbrica de Evaluación.pdf", size:"156 KB", type:"PDF", downloadUrl:"enlace de google drive" },{ name:"Ejemplos de Análisis.docx", size:"89 KB", type:"Word", downloadUrl:"enlace desde github" }] },
    { id:103, task:"Línea de tiempo S.XIX", teacher:"Prof. Diana Prince", deadline:"2025-05-10", status:"Pendiente", description:"Crear una línea de tiempo interactiva que muestre los eventos más importantes del siglo XIX a nivel mundial.", requirements:["Mínimo 20 eventos históricos relevantes","Incluir imágenes representativas de cada evento","Descripción de 50-100 palabras por evento","Formato digital (PowerPoint, Prezi o similar)","Presentación visual atractiva y organizada"], attachments:[{ name:"Plantilla Línea de Tiempo.pptx", size:"512 KB", type:"PowerPoint", downloadUrl:"enlace de google drive" },{ name:"Lista de Eventos Sugeridos.pdf", size:"198 KB", type:"PDF", downloadUrl:"enlace desde github" }] }
];

// ============================================
// RECURSOS DB — Solo Documentos, Videos, Imágenes
// ============================================
const recursosDB = {
    Documentos: [
        {
            id: 'doc-1',
            title: "Manual de Redacción Periodística",
            description: "Guía completa sobre técnicas de redacción para medios de comunicación",
            type: "PDF",
            coverImage: "https://via.placeholder.com/400x250/3b82f6/ffffff?text=Manual+Redaccion",
            urlView: "https://drive.google.com/file/d/EJEMPLO1/preview",
            urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO1"
        },
        {
            id: 'doc-2',
            title: "Teorías de la Comunicación",
            description: "Documento académico sobre las principales teorías comunicativas",
            type: "PDF",
            coverImage: "https://via.placeholder.com/400x250/2563eb/ffffff?text=Teorias+Comunicacion",
            urlView: "https://drive.google.com/file/d/EJEMPLO2/preview",
            urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO2"
        },
        {
            id: 'doc-3',
            title: "Antología de Cuentos Latinoamericanos",
            description: "Colección de cuentos clásicos de autores latinoamericanos",
            type: "PDF",
            coverImage: "https://via.placeholder.com/400x250/f59e0b/ffffff?text=Cuentos",
            urlView: "https://drive.google.com/file/d/EJEMPLO3/preview",
            urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO3"
        }
    ],
    Videos: [
        {
            id: 'vid-1',
            title: "Introducción a la Comunicación Digital",
            description: "Video tutorial sobre fundamentos de comunicación en medios digitales",
            type: "Video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
        }
    ],
    Imágenes: [
        {
            id: 'img-1',
            title: "Infografía: Proceso Comunicativo",
            description: "Representación visual del modelo de comunicación de Shannon y Weaver",
            type: "Imagen",
            imageUrl: "https://via.placeholder.com/600x400/10b981/ffffff?text=Proceso+Comunicativo"
        }
    ]
};

// ── Variables globales ──
let currentRecursosCategory = 'Materiales';
let currentRecursosType     = 'Documentos';

const filesGrid             = document.getElementById('files-grid');
const assignmentsContainer  = document.getElementById('assignments-container');
const finalizadosContainer  = document.getElementById('finalizados-container');
const recursosContainer     = document.getElementById('recursos-container');
const docentesGrid          = document.getElementById('docentes-grid');
const sectionRepositorio    = document.getElementById('repositorio');
const sectionTrabajos       = document.getElementById('trabajos');
const sectionRecursos       = document.getElementById('recursos');
const sectionLibros         = document.getElementById('libros');
const sectionDocentes       = document.getElementById('docentes');
const sectionEstudiantes    = document.getElementById('estudiantes');
const sectionChat           = document.getElementById('chat');

const trabajosPendientesSection  = document.getElementById('trabajos-pendientes-section');
const trabajosFinalizadosSection = document.getElementById('trabajos-finalizados-section');
const profileModal      = document.getElementById('profileModal');
const modalProfileImage = document.getElementById('modalProfileImage');
const modalProfileInfo  = document.getElementById('modalProfileInfo');
const detailsModal      = document.getElementById('detailsModal');
const fileViewerModal   = document.getElementById('fileViewerModal');
const fileViewerContent = document.getElementById('fileViewerContent');
const completedModal    = document.getElementById('completedModal');

let currentFilter               = 'all';
let currentTab                  = 'repositorio';
let currentAssignmentToComplete = null;
let showingFinalizados          = false;
let fullscreenCloseBtn          = null;

// ============================================
// TRABAJOS: LÓGICA DE COMPLETADOS
// ============================================
function getCompletedAssignments() { const c = localStorage.getItem('completedAssignments'); return c ? JSON.parse(c) : []; }
function saveCompletedAssignment(assignmentId) { const c = getCompletedAssignments(); if (!c.includes(assignmentId)) { c.push(assignmentId); localStorage.setItem('completedAssignments', JSON.stringify(c)); } }
function getPendingAssignments()  { const c = getCompletedAssignments(); return assignmentsDB.filter(a => !c.includes(a.id)); }
function getFinishedAssignments() { const c = getCompletedAssignments(); return assignmentsDB.filter(a =>  c.includes(a.id)); }

// ============================================
// BÚSQUEDA
// ============================================
function toggleSearch(section) {
    const searchBar   = document.getElementById(`searchBar${section.charAt(0).toUpperCase() + section.slice(1)}`);
    const searchInput = searchBar.querySelector('input');
    searchBar.classList.toggle('active');
    if (searchBar.classList.contains('active')) { setTimeout(() => searchInput.focus(), 300); }
    else { searchInput.value = ''; if (section === 'repositorio') searchFiles(); else if (section === 'recursos') searchRecursos(); }
}

function updatePendingBadge() {
    const pendingCount = getPendingAssignments().length;
    const badgeSidebar = document.getElementById('pending-badge');
    const badgeFooter  = document.getElementById('pending-badge-footer');
    if (pendingCount > 0) { if (badgeSidebar) badgeSidebar.style.display = 'block'; if (badgeFooter) badgeFooter.style.display = 'block'; }
    else                  { if (badgeSidebar) badgeSidebar.style.display = 'none';  if (badgeFooter) badgeFooter.style.display = 'none';  }
}

function normalizeText(text) { return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }

function calculateRelevance(item, searchTerms, searchableFields) {
    let score = 0;
    const normalizedFields = searchableFields.map(field => normalizeText(item[field] || ''));
    searchTerms.forEach(term => {
        normalizedFields.forEach((field, index) => {
            if (field.includes(term)) {
                if (field === term)              score += 10;
                else if (field.startsWith(term)) score += 5;
                else                             score += 2;
                if (index === 0)                 score += 3;
            }
        });
    });
    return score;
}

function searchFiles() {
    const searchTerm = document.getElementById('searchInputRepositorio').value.toLowerCase().trim();
    if (searchTerm === '') { renderFiles(currentFilter); return; }
    const searchTerms   = normalizeText(searchTerm).split(/\s+/);
    const filteredFiles = filesDB
        .filter(file => currentFilter === 'all' || file.area === currentFilter)
        .map(file  => ({ ...file, relevance: calculateRelevance(file, searchTerms, ['title','area','teacher']) }))
        .filter(file => file.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);
    renderFilesArray(filteredFiles);
}

function searchRecursos() {
    const searchTerm = document.getElementById('searchInputRecursos').value.toLowerCase().trim();
    if (searchTerm === '') { renderRecursosContent(); return; }
    const searchTerms = normalizeText(searchTerm).split(/\s+/);
    let allRecursos   = [];
    Object.keys(recursosDB).forEach(category => {
        if (category === 'Libros') { allRecursos = allRecursos.concat(recursosDB[category].map(r => ({ ...r, category }))); }
        else { Object.keys(recursosDB[category]).forEach(type => { allRecursos = allRecursos.concat(recursosDB[category][type].map(r => ({ ...r, category, type }))); }); }
    });
    const filteredRecursos = allRecursos.map(r => ({ ...r, relevance: calculateRelevance(r, searchTerms, ['title','description']) })).filter(r => r.relevance > 0).sort((a, b) => b.relevance - a.relevance);
    recursosContainer.innerHTML = '';
    if (filteredRecursos.length === 0) { recursosContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No se encontraron recursos.</p>'; return; }
    filteredRecursos.forEach(r => { if (r.type === 'Video') renderVideoCard(r); else if (r.type === 'Imagen') renderImageCard(r); else renderDocumentCard(r); });
}

// ============================================
// RECURSOS — VERSIÓN SIMPLIFICADA
// ============================================

let currentRecursosTipo = 'Documentos';

function filterRecursosTipo(tipo) {
    currentRecursosTipo = tipo;

    // Actualizar botones activos
    document.querySelectorAll('.recursos-tipo-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btnActivo = document.getElementById(`rtbtn-${tipo}`);
    if (btnActivo) btnActivo.classList.add('active');

    renderRecursosContent();
}

function renderRecursosContent() {
    if (!recursosContainer) return;
    recursosContainer.innerHTML = '';

    const lista = recursosDB[currentRecursosTipo] || [];

    if (lista.length === 0) {
        recursosContainer.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;
                      color:var(--text-muted);padding:3rem;">
                No hay ${currentRecursosTipo} disponibles aún.
            </p>`;
        return;
    }

    lista.forEach(recurso => {
        if (recurso.type === 'Video')  renderVideoCard(recurso);
        else if (recurso.type === 'Imagen') renderImageCard(recurso);
        else renderDocumentCard(recurso);
    });
}

function renderDocumentCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-card');

    let icon = 'fa-file-pdf';
    if (recurso.type === 'DOCX' || recurso.type === 'DOC')       icon = 'fa-file-word';
    else if (recurso.type === 'PPTX' || recurso.type === 'PPT')  icon = 'fa-file-powerpoint';

    card.innerHTML = `
        <div class="recurso-cover">
            ${recurso.coverImage
                ? `<img src="${recurso.coverImage}" alt="${recurso.title}">`
                : `<i class="fa-solid ${icon}"></i>`}
        </div>
        <div class="recurso-card-content">
            <span class="recurso-card-type">${recurso.type}</span>
            <h3 class="recurso-card-title">${recurso.title}</h3>
            <p class="recurso-card-description">${recurso.description}</p>
            <div class="recurso-card-actions">
                <button onclick="viewFile('${recurso.urlView}')"
                        class="btn btn-view">
                    <i class="fa-regular fa-eye"></i> Ver
                </button>
                <a href="${recurso.urlDownload}" download
                   class="btn btn-download">
                    <i class="fa-solid fa-download"></i> Descargar
                </a>
            </div>
        </div>`;
    recursosContainer.appendChild(card);
}

function renderVideoCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');
    card.innerHTML = `
        <div class="recurso-multimedia-content">
            <iframe src="${recurso.videoUrl}" frameborder="0" allowfullscreen></iframe>
        </div>
        <div class="recurso-multimedia-description">
            <h3 style="color:var(--text-light);margin-bottom:.5rem;">${recurso.title}</h3>
            <p>${recurso.description}</p>
        </div>`;
    recursosContainer.appendChild(card);
}

function renderImageCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');
    card.innerHTML = `
        <div class="recurso-multimedia-content">
            <img src="${recurso.imageUrl}" alt="${recurso.title}">
        </div>
        <div class="recurso-multimedia-description">
            <h3 style="color:var(--text-light);margin-bottom:.5rem;">${recurso.title}</h3>
            <p>${recurso.description}</p>
        </div>`;
    recursosContainer.appendChild(card);
}

// ============================================
// BÚSQUEDA EN RECURSOS — VERSIÓN SIMPLIFICADA
// ============================================

function searchRecursos() {
    const searchTerm = document.getElementById('searchInputRecursos').value.toLowerCase().trim();
    if (searchTerm === '') { renderRecursosContent(); return; }

    const searchTerms = normalizeText(searchTerm).split(/\s+/);
    const lista = recursosDB[currentRecursosTipo] || [];

    const filtrados = lista
        .map(r => ({ ...r, relevance: calculateRelevance(r, searchTerms, ['title','description']) }))
        .filter(r => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

    recursosContainer.innerHTML = '';

    if (filtrados.length === 0) {
        recursosContainer.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;
                      color:var(--text-muted);padding:2rem;">
                No se encontraron resultados.
            </p>`;
        return;
    }

    filtrados.forEach(r => {
        if (r.type === 'Video')        renderVideoCard(r);
        else if (r.type === 'Imagen')  renderImageCard(r);
        else                           renderDocumentCard(r);
    });
}

// ============================================
// LIBROS — FUNCIONES COMPLETAS
// ============================================

let currentLibrosCategoria = 'Todo';

function filterLibros(categoria) {
    currentLibrosCategoria = categoria;

    // Actualizar botones activos
    document.querySelectorAll('.libros-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btnActivo = document.getElementById(`lbtn-${categoria}`);
    if (btnActivo) btnActivo.classList.add('active');

    cargarLibros();
}

let _librosRealtimeRef = null;

async function cargarLibros() {
    const grid = document.getElementById('libros-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="libros-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Cargando libros...</p>
        </div>`;

    // Desconectar listener anterior si existe
    if (_librosRealtimeRef) {
        _librosRealtimeRef.off('value');
        _librosRealtimeRef = null;
    }

    _librosRealtimeRef = database.ref('libros');

    _librosRealtimeRef.on('value', (snap) => {
        const val = snap.val();

        let lista = [];

        if (val) {
            lista = Object.entries(val)
                .map(([key, data]) => ({ _key: key, ...data }))
                .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        }

        // Filtrar por categoría si no es "Todo"
        if (currentLibrosCategoria !== 'Todo') {
            lista = lista.filter(l => l.categoria === currentLibrosCategoria);
        }

        renderLibros(lista);
    }, (error) => {
        console.error('Error cargando libros:', error);
        grid.innerHTML = `
            <div class="libros-empty">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Error al cargar los libros.</p>
            </div>`;
    });
}

function renderLibros(libros) {
    const grid = document.getElementById('libros-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!libros || libros.length === 0) {
        grid.innerHTML = `
            <div class="libros-empty">
                <i class="fa-solid fa-book-open"></i>
                <p>No hay libros en esta categoría aún.</p>
            </div>`;
        return;
    }

    libros.forEach((libro, idx) => {
        const card = document.createElement('div');
        card.className = 'libro-card';
        card.style.animation      = 'fadeIn 0.4s ease';
        card.style.animationDelay = `${idx * 0.06}s`;

        const fallbackPortada = `https://ui-avatars.com/api/?name=${encodeURIComponent(libro.titulo || 'Libro')}&background=3b82f6&color=fff&size=400&font-size=0.25`;

        card.innerHTML = `
            <div class="libro-card-portada">
                ${libro.portada_url
                    ? `<img src="${libro.portada_url}"
                            alt="${libro.titulo}"
                            onerror="this.style.display='none';
                                     this.parentElement.querySelector('.libro-card-portada-fallback').style.display='flex'">
                       <i class="fa-solid fa-book libro-card-portada-fallback"
                          style="display:none;font-size:3.5rem;color:rgba(255,255,255,.6);"></i>`
                    : `<i class="fa-solid fa-book libro-card-portada-fallback"></i>`}
                <span class="libro-card-categoria-badge">
                    ${libro.categoria || 'Sin categoría'}
                </span>
            </div>
            <div class="libro-card-body">
                <h3 class="libro-card-titulo">${libro.titulo || 'Sin título'}</h3>
                <p class="libro-card-descripcion">
                    ${libro.descripcion || 'Sin descripción disponible.'}
                </p>
                <div class="libro-card-acciones">
                    <button class="btn-contexto"
                            onclick="abrirContextoLibro(
                                '${(libro.titulo || '').replace(/'/g,"\\'")}',
                                '${(libro.contexto || '').replace(/'/g,"\\'").replace(/\n/g,'\\n')}',
                                '${libro.portada_url || ''}',
                                '${libro.categoria || ''}'
                            )">
                        <i class="fa-solid fa-circle-info"></i> Contexto
                    </button>
                    <a href="${libro.archivo_url || '#'}"
                       target="_blank"
                       rel="noopener noreferrer"
                       class="btn-descargar-libro"
                       ${!libro.archivo_url ? 'style="opacity:.5;pointer-events:none;"' : ''}>
                        <i class="fa-solid fa-download"></i> Descargar
                    </a>
                </div>
            </div>`;

        grid.appendChild(card);
    });
}

function abrirContextoLibro(titulo, contexto, portadaUrl, categoria) {
    document.getElementById('contexto-titulo').textContent    = titulo;
    document.getElementById('contexto-texto').textContent     = contexto || 'No hay contexto disponible para este libro.';
    document.getElementById('contexto-categoria-badge').textContent = categoria || '';

    const img = document.getElementById('contexto-portada-img');
    if (portadaUrl) {
        img.src     = portadaUrl;
        img.style.display = 'block';
        img.onerror = function() { this.style.display = 'none'; };
    } else {
        img.style.display = 'none';
    }

    document.getElementById('modalContextoLibro').style.display = 'block';
}

function cerrarContextoLibro() {
    document.getElementById('modalContextoLibro').style.display = 'none';
}

// ============================================
// REPOSITORIO
// ============================================
function renderFiles(filter = 'all') {
    currentFilter = filter; filesGrid.innerHTML = '';
    const filteredFiles = filter === 'all' ? filesDB : filesDB.filter(file => file.area === filter);
    renderFilesArray(filteredFiles);
}

function renderFilesArray(files) {
    filesGrid.innerHTML = '';
    if (files.length === 0) { filesGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);">No se encontraron archivos.</p>'; return; }
    files.forEach(file => {
        const teacher = teachersDB[file.teacher];
        const card    = document.createElement('div'); card.classList.add('file-card');
        let iconClass = 'fa-file-pdf';
        if (file.type === 'DOCX' || file.type === 'DOC')      iconClass = 'fa-file-word';
        else if (file.type === 'PPTX' || file.type === 'PPT') iconClass = 'fa-file-powerpoint';
        else if (file.type === 'XLSX' || file.type === 'XLS') iconClass = 'fa-file-excel';
        card.innerHTML = `<div class="file-cover"><i class="fa-solid ${iconClass} file-cover-icon"></i><span class="file-cover-badge">${file.area}</span></div><div class="file-card-body"><h3 class="file-title">${file.title}</h3><div class="file-details"><p><i class="fa-regular fa-calendar"></i> ${file.date}</p><div class="teacher-profile"><img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar" onclick="openProfileModal('${file.teacher}')"><span class="teacher-name">${teacher.name}</span></div></div><div class="card-actions"><button onclick="viewFile('${file.urlView}')" class="btn btn-view"><i class="fa-regular fa-eye"></i> Ver</button><a href="${file.urlDownload}" download class="btn btn-download"><i class="fa-solid fa-download"></i> Descargar</a></div></div>`;
        filesGrid.appendChild(card);
    });
}

function filterFiles(area) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active'); renderFiles(area);
    document.getElementById('searchInputRepositorio').value = '';
}

function viewFile(url) {
    fileViewerContent.innerHTML = `<div class="skeleton-loader"><div class="skeleton-header"><div class="skeleton-avatar"></div><div class="skeleton-text"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line medium"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    fileViewerModal.style.display = 'block';
    let previewUrl = url;
    if (!previewUrl.includes('/preview')) {
        if (previewUrl.includes('/edit')) previewUrl = previewUrl.replace('/edit', '/preview');
        else if (previewUrl.includes('drive.google.com/file/d/')) previewUrl = previewUrl.replace('/view', '/preview');
    }
    setTimeout(() => { fileViewerContent.innerHTML = `<iframe id="googleDriveFrame" src="${previewUrl}" frameborder="0" class="google-drive-iframe"></iframe>`; }, 800);
}

function openFullscreen() {
    const iframe = document.getElementById('googleDriveFrame');
    if (iframe) {
        if (!fullscreenCloseBtn) { fullscreenCloseBtn = document.createElement('button'); fullscreenCloseBtn.className = 'fullscreen-close-btn'; fullscreenCloseBtn.innerHTML = '<i class="fa-solid fa-times"></i>'; fullscreenCloseBtn.onclick = exitFullscreen; document.body.appendChild(fullscreenCloseBtn); }
        if (iframe.requestFullscreen)            iframe.requestFullscreen().then(() => fullscreenCloseBtn.classList.add('active'));
        else if (iframe.webkitRequestFullscreen) { iframe.webkitRequestFullscreen(); fullscreenCloseBtn.classList.add('active'); }
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    }
}

function exitFullscreen() { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); if (fullscreenCloseBtn) fullscreenCloseBtn.classList.remove('active'); }
function handleFullscreenChange() { if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (fullscreenCloseBtn) fullscreenCloseBtn.classList.remove('active'); } }
function closeFileViewerModal() { fileViewerModal.style.display = 'none'; fileViewerContent.innerHTML = ''; if (document.fullscreenElement || document.webkitFullscreenElement) exitFullscreen(); }

// ============================================
// TRABAJOS
// ============================================
function toggleTrabajosFinalizados() {
    showingFinalizados = !showingFinalizados;
    const btnText = document.getElementById('btn-trabajos-text');
    const btn     = document.getElementById('btn-trabajos-finalizados');
    const btnIcon = btn.querySelector('i');
    const pendTitle = document.getElementById('trabajos-pendientes-title');
    const finTitle  = document.getElementById('trabajos-finalizados-title');
    if (showingFinalizados) {
        trabajosPendientesSection.style.display = 'none'; trabajosFinalizadosSection.style.display = 'block';
        pendTitle.style.display = 'none'; finTitle.style.display = 'block';
        btnText.textContent = 'Ver trabajos pendientes'; btnIcon.className = 'fa-solid fa-clock'; btn.classList.add('showing-finalizados'); renderFinalizados();
    } else {
        trabajosPendientesSection.style.display = 'block'; trabajosFinalizadosSection.style.display = 'none';
        pendTitle.style.display = 'block'; finTitle.style.display = 'none';
        btnText.textContent = 'Ver trabajos finalizados'; btnIcon.className = 'fa-solid fa-check-circle'; btn.classList.remove('showing-finalizados');
    }
}

function renderAssignments() {
    assignmentsContainer.innerHTML = '';
    const pendingAssignments = getPendingAssignments();
    if (pendingAssignments.length === 0) { assignmentsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay trabajos pendientes. ¡Excelente trabajo!</p>'; return; }
    pendingAssignments.forEach(work => {
        const teacher = teachersDB[work.teacher];
        let statusClass = '';
        switch(work.status) { case 'Pendiente': statusClass = 'status-pending'; break; case 'Entregado': statusClass = 'status-submitted'; break; case 'Atrasado': statusClass = 'status-late'; break; }
        const card = document.createElement('div'); card.classList.add('assignment-card');
        card.innerHTML = `<div class="assignment-header"><h3 class="assignment-title">${work.task}</h3><span class="status-badge ${statusClass}">${work.status}</span></div><div class="assignment-teacher"><img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar-card" onclick="openProfileModal('${work.teacher}')"><div class="teacher-info"><span class="teacher-info-name">${teacher.name}</span><span class="teacher-info-title">${teacher.title}</span></div></div><div class="assignment-meta"><div class="meta-item"><i class="fa-regular fa-calendar"></i><span>Fecha límite: ${work.deadline}</span></div></div><div class="assignment-actions"><button class="btn btn-view" onclick="openDetailsModal(${work.id})"><i class="fa-solid fa-info-circle"></i> Ver Detalles</button><button class="btn btn-completed" onclick="openCompletedModal(${work.id})"><i class="fa-solid fa-check-circle"></i> Cumplido</button></div>`;
        assignmentsContainer.appendChild(card);
    });
}

function renderFinalizados() {
    finalizadosContainer.innerHTML = '';
    const finishedAssignments = getFinishedAssignments();
    if (finishedAssignments.length === 0) { finalizadosContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay trabajos finalizados aún.</p>'; return; }
    finishedAssignments.forEach(work => {
        const teacher = teachersDB[work.teacher];
        const card = document.createElement('div'); card.classList.add('assignment-card');
        card.innerHTML = `<div class="assignment-header"><h3 class="assignment-title">${work.task}</h3><span class="status-badge status-submitted">Finalizado</span></div><div class="assignment-teacher"><img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar-card" onclick="openProfileModal('${work.teacher}')"><div class="teacher-info"><span class="teacher-info-name">${teacher.name}</span><span class="teacher-info-title">${teacher.title}</span></div></div><div class="assignment-meta"><div class="meta-item"><i class="fa-regular fa-calendar"></i><span>Fecha límite: ${work.deadline}</span></div><div class="meta-item"><i class="fa-solid fa-check"></i><span>Completado</span></div></div><div class="assignment-actions"><button class="btn btn-view" onclick="openDetailsModal(${work.id})"><i class="fa-solid fa-info-circle"></i> Ver Detalles</button></div>`;
        finalizadosContainer.appendChild(card);
    });
}

function openCompletedModal(assignmentId) {
    const assignment = assignmentsDB.find(a => a.id === assignmentId);
    if (!assignment) return;
    currentAssignmentToComplete = assignmentId;
    const teacher = teachersDB[assignment.teacher];
    document.getElementById('completedMessage').innerHTML = `Has finalizado el trabajo de <strong>${teacher.name}</strong>:<br><br><strong>Trabajo:</strong> ${assignment.task}<br><strong>Fecha límite:</strong> ${assignment.deadline}<br><br>Se moverá a 'Trabajos Finalizados'.`;
    completedModal.style.display = 'block';
}

function closeCompletedModal() { completedModal.style.display = 'none'; currentAssignmentToComplete = null; }
function confirmCompleted() { if (currentAssignmentToComplete) { saveCompletedAssignment(currentAssignmentToComplete); updatePendingBadge(); renderAssignments(); closeCompletedModal(); } }

// ============================================
// DOCENTES
// ============================================
function renderDocentes() {
    docentesGrid.innerHTML = '';
    Object.values(teachersDB).forEach(teacher => {
        const card = document.createElement('div'); card.classList.add('docente-card');
        card.innerHTML = `<img src="${teacher.photo}" alt="${teacher.name}" class="docente-avatar-large"><h3 class="docente-name">${teacher.name}</h3><p class="docente-title">${teacher.title}</p><div class="docente-info"><p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p><p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p></div>`;
        docentesGrid.appendChild(card);
    });
}

// ============================================
// MODALES
// ============================================
function openProfileModal(teacherName) {
    const teacher = teachersDB[teacherName];
    if (!teacher) return;
    modalProfileImage.src = teacher.photo; modalProfileImage.alt = teacher.name;
    modalProfileInfo.innerHTML = `<h3>${teacher.name}</h3><p><strong>${teacher.title}</strong></p><p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p><p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p>`;
    profileModal.style.display = 'block';
}

function closeProfileModal() { profileModal.style.display = 'none'; }

function openDetailsModal(assignmentId) {
    const assignment = assignmentsDB.find(a => a.id === assignmentId);
    if (!assignment) return;
    document.getElementById('detailsTaskName').textContent = assignment.task;
    document.getElementById('detailsTeacher').textContent  = assignment.teacher;
    document.getElementById('detailsDeadline').textContent = assignment.deadline;
    const completed   = getCompletedAssignments();
    const isCompleted = completed.includes(assignment.id);
    document.getElementById('detailsStatus').innerHTML = isCompleted ? '<span class="status-badge status-submitted">Finalizado</span>' : `<span class="status-badge status-pending">${assignment.status}</span>`;
    document.getElementById('detailsDescription').textContent = assignment.description;
    const reqList = document.getElementById('detailsRequirements'); reqList.innerHTML = '';
    assignment.requirements.forEach(req => { const li = document.createElement('li'); li.textContent = req; reqList.appendChild(li); });
    const attList = document.getElementById('detailsAttachments'); attList.innerHTML = '';
    if (assignment.attachments && assignment.attachments.length > 0) {
        assignment.attachments.forEach(att => {
            const div = document.createElement('div'); div.classList.add('attachment-item');
            let icon = 'fa-file-lines';
            if (att.type === 'PDF') icon = 'fa-file-pdf';
            else if (att.type === 'Word' || att.type === 'DOCX') icon = 'fa-file-word';
            else if (att.type === 'Excel') icon = 'fa-file-excel';
            else if (att.type === 'PowerPoint') icon = 'fa-file-powerpoint';
            div.innerHTML = `<div class="attachment-info"><i class="fa-solid ${icon} attachment-icon"></i><div class="attachment-details"><h5>${att.name}</h5><p>${att.size}</p></div></div><a href="${att.downloadUrl}" target="_blank" class="attachment-download"><i class="fa-solid fa-download"></i> Descargar</a>`;
            attList.appendChild(div);
        });
    } else { attList.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">No hay archivos adjuntos</p>'; }
    detailsModal.style.display = 'block';
}

function closeDetailsModal() { detailsModal.style.display = 'none'; }

window.onclick = function(event) {
    if (event.target === profileModal)    closeProfileModal();
    if (event.target === detailsModal)    closeDetailsModal();
    if (event.target === fileViewerModal) closeFileViewerModal();
    if (event.target === completedModal)  closeCompletedModal();
    const modalContexto = document.getElementById('modalContextoLibro');
    if (event.target === modalContexto)   cerrarContextoLibro();
};


// ============================================
// SISTEMA DE REGISTRO DE ESTUDIANTES
// ============================================
let selectedEspecialidad = '';
let selectedCiclo        = '';
let selectedImageDataUrl = '';
let selectedImageFile    = null;
let registroFotoFile = null;

const CLOUDINARY_CONFIG = { CLOUD_NAME: "dwzwa3gp0", UPLOAD_PRESET: "hfqqxu13" };
const SUPABASE_CONFIG   = {
    URL: 'https://pauaqgfqsitnjsikrjns.supabase.co',
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdWFxZ2Zxc2l0bmpzaWtyam5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMxODYsImV4cCI6MjA4NjY2OTE4Nn0.Jz-rCRPQkgm9wXicGRoCP4xP-NotY-YEQXUyxgU7HeM'
};


let supabaseClient      = null;
let estudiantesListener = null;

function initSupabase() {
    try { if (typeof supabase !== 'undefined') { supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY); return true; } return false; }
    catch(error) { console.error('Error al inicializar Supabase:', error); return false; }
}

document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
});

function openRegistroModal() {
    const studentProfile = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (studentProfile && studentProfile.supabase_registered) { abrirPerfilEstudiante(); return; }
    const modal = document.getElementById('registroModal');
    modal.style.display = 'block';
    const sinPerfilDiv      = document.getElementById('registro-sin-perfil');
    const terminosContainer = document.querySelector('.terminos-container');
    const formRegistro      = document.getElementById('form-registro');
    if (studentProfile && !studentProfile.supabase_registered) {
        if (sinPerfilDiv)      sinPerfilDiv.style.display      = 'none';
        if (terminosContainer) { terminosContainer.style.display = 'block'; terminosContainer.style.opacity = '1'; terminosContainer.style.transform = 'translateY(0)'; }
        if (formRegistro)      { formRegistro.style.display = 'none'; formRegistro.style.opacity = '0'; }
        document.getElementById('aceptoTerminos').checked = false;
        return;
    }
    if (sinPerfilDiv)      sinPerfilDiv.style.display      = 'block';
    if (terminosContainer) terminosContainer.style.display = 'none';
    if (formRegistro)      formRegistro.style.display      = 'none';
}

function closeRegistroModal() {
    document.getElementById('registroModal').style.display = 'none';
    registroFotoFile = null;
}

function previewImage(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('⚠️ La imagen es muy grande. El tamaño máximo es 5MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('⚠️ Por favor selecciona un archivo de imagen válido.'); return; }
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedImageDataUrl = e.target.result;
        document.getElementById('previewImgPaso0').src = e.target.result;
        document.getElementById('uploadPlaceholderPaso0').style.display = 'none';
        document.getElementById('imagePreviewPaso0').style.display      = 'block';
    };
    reader.readAsDataURL(file);
}

function resetImagePreview() {
    const ph = document.getElementById('uploadPlaceholderPaso0'), prev = document.getElementById('imagePreviewPaso0');
    const img = document.getElementById('previewImgPaso0'), inp = document.getElementById('fotoInputPaso0');
    if (ph) ph.style.display = 'block'; if (prev) prev.style.display = 'none';
    if (img) img.src = ''; if (inp) inp.value = ''; selectedImageDataUrl = '';
}

function mostrarToast(mensaje, icono = 'fa-check-circle', duracion = 3000) {
    const toast = document.createElement('div'); toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fa-solid ${icono}"></i><span>${mensaje}</span>`;
    document.body.appendChild(toast); setTimeout(() => toast.remove(), duracion);
}


// ============================================
// REGISTRO DE ESTUDIANTE EN SUPABASE
// ============================================
async function registrarEstudiante() {
    const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
    const btnRegistrar   = document.getElementById('btnRegistrar');
    const errFotoEl      = document.getElementById('reg-foto-error');
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');

    if (!perfil) { alert('❌ No se encontró tu perfil. Cierra sesión e inicia nuevamente.'); return; }
    if (!nombreCompleto || nombreCompleto.length < 3) { alert('⚠️ El nombre es muy corto o está vacío.'); return; }

    // Validar foto obligatoria
    const tieneFotoActual = !!(perfil.foto_url && perfil.foto_url.trim() !== '');
    if (!tieneFotoActual && !registroFotoFile) {
        if (errFotoEl) errFotoEl.style.display = 'flex';
        mostrarToast('⚠️ La foto es obligatoria para unirte', 'fa-exclamation-circle');
        return;
    }

    if (!supabaseClient) { alert('❌ Error: No se pudo conectar con la base de datos.'); return; }
    btnRegistrar.disabled = true; btnRegistrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        let fotoUrl = perfil.foto_url || '';

        // Subir nueva foto si se seleccionó en el modal
        if (registroFotoFile) {
            const formData = new FormData();
            formData.append('file', registroFotoFile);
            formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
            formData.append('folder', 'estudiantes_clouddesk');
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            if (uploadRes.ok) { const cloudData = await uploadRes.json(); fotoUrl = cloudData.secure_url; }
        }

        if (!fotoUrl) {
            if (errFotoEl) errFotoEl.style.display = 'flex';
            mostrarToast('⚠️ Error al subir la foto. Inténtalo de nuevo.', 'fa-exclamation-circle');
            return;
        }

        const { data, error } = await supabaseClient
            .from('estudiantes')
            .insert([{ nombre_completo: nombreCompleto, foto_url: fotoUrl, especialidad: perfil.especialidad, ciclo: perfil.ciclo }])
            .select();
        if (error) throw new Error(`Error al guardar: ${error.message}`);

        perfil.supabase_registered = true;
        perfil.foto_url            = fotoUrl;
        perfil.fecha_registro      = new Date().toLocaleDateString('es-ES');
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));

        const authDataReg = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');
        if (authDataReg.codigo) {
            await database.ref(`codigos/${authDataReg.codigo}/perfil`).update({
                supabase_registered: true,
                fecha_registro:      perfil.fecha_registro,
                foto_url:            fotoUrl
            }).catch(console.error);
        }

        const btnRegistrarme = document.getElementById('btn-registrarme');
        if (btnRegistrarme) btnRegistrarme.style.display = 'none';

        registroFotoFile = null;
        actualizarPerfilSidebar();
        actualizarEncabezadoEstudiantes();
        closeRegistroModal();
        mostrarToast('🎉 ¡Registro exitoso! Bienvenido/a a la comunidad CloudDesk');
        await cargarEstudiantes();
    } catch(error) {
        console.error('Error:', error); alert(`❌ Error: ${error.message}`);
    } finally {
        btnRegistrar.disabled = false; btnRegistrar.innerHTML = '<i class="fa-solid fa-check-circle"></i> Unirme Ahora';
    }
}

// ============================================
// RENDER ESTUDIANTES — CON BOTÓN SOLICITUD
// ============================================
async function renderEstudiantesReales(estudiantes) {
    const grid    = document.getElementById('estudiantes-grid');
    const loading = document.getElementById('loading-estudiantes');
    if (loading) loading.style.display = 'none';

    if (!estudiantes || estudiantes.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
            <i class="fa-solid fa-users" style="font-size:4rem;margin-bottom:1rem;opacity:.5;"></i>
            <p style="font-size:1.2rem;">Aún no hay estudiantes registrados.</p>
            <p>¡Sé el primero en unirte!</p>
        </div>`;
        return;
    }

    const perfilActual = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const nombreActual = perfilActual?.nombre?.trim().toLowerCase() || '';
    const miKey        = getMiKey();

    let amigosKeys = [];
    if (miKey) {
        try {
            const snapAmigos = await database.ref(`amigos/${miKey}`).once('value');
            if (snapAmigos.val()) amigosKeys = Object.keys(snapAmigos.val());
        } catch(e) { console.error('Error cargando amigos:', e); }
    }

    grid.innerHTML = '';

    estudiantes.forEach((estudiante, index) => {
        const esYoMismo = perfilActual?.supabase_registered &&
            estudiante.nombre_completo.trim().toLowerCase() === nombreActual;

        const otroKey = toKey(estudiante.nombre_completo);
        const esAmigo = amigosKeys.includes(otroKey);

        if (esYoMismo || esAmigo) return;

        const card = document.createElement('div');
        card.classList.add('estudiante-card');
        card.style.animation      = 'fadeIn 0.5s ease';
        card.style.animationDelay = `${index * 0.1}s`;

        const espBadge = estudiante.especialidad
            ? `<p class="estudiante-especialidad"><i class="fa-solid fa-graduation-cap"></i> ${estudiante.especialidad} &nbsp;·&nbsp; Ciclo ${estudiante.ciclo || ''}</p>`
            : '';

        card.dataset.otroKey   = otroKey;
        card.dataset.otroNom   = estudiante.nombre_completo;
        card.dataset.otroFoto  = estudiante.foto_url || '';
        card.dataset.otroEsp   = estudiante.especialidad || '';
        card.dataset.otroCiclo = estudiante.ciclo || '';

        card.innerHTML = `
            <img src="${estudiante.foto_url}" alt="${estudiante.nombre_completo}"
                 class="estudiante-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(estudiante.nombre_completo)}&background=3b82f6&color=fff&size=200'">
            <h3 class="estudiante-name">${estudiante.nombre_completo}</h3>
            ${espBadge}
            <button class="btn-solicitud" id="btn-sol-${otroKey}" title="Enviar solicitud de amistad">
                <i class="fa-solid fa-user-plus"></i>
            </button>
        `;

        const btnSol = card.querySelector('.btn-solicitud');
        btnSol.addEventListener('click', function(e) {
            e.stopPropagation();
            const c = this.closest('.estudiante-card');
            manejarBtnSolicitud(
                c.dataset.otroKey,
                c.dataset.otroNom,
                c.dataset.otroFoto,
                c.dataset.otroEsp,
                c.dataset.otroCiclo,
                this
            );
        });

        // Click en la tarjeta para ver la foto ampliada
        card.addEventListener('click', function(e) {
            if (e.target.closest('.btn-solicitud')) return;
            abrirFotoEstudiante(
                this.dataset.otroFoto,
                this.dataset.otroNom
            );
        });

        if (!perfilActual?.supabase_registered) {
            btnSol.style.display = 'none';
        } else {
            actualizarEstadoBtnSolicitud(otroKey, `btn-sol-${otroKey}`);
        }

        grid.appendChild(card);
    });
}

async function cargarEstudiantes() {
    const grid    = document.getElementById('estudiantes-grid');
    const loading = document.getElementById('loading-estudiantes');
    if (!grid) return;
    if (loading) loading.style.display = 'flex';

    if (!supabaseClient) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--danger);padding:2rem;">Error de conexión con Supabase.</p>';
        if (loading) loading.style.display = 'none';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('estudiantes')
            .select('*')
            .order('nombre_completo', { ascending: true });

        if (error) throw new Error(error.message);
        await renderEstudiantesReales(data || []);
    } catch (e) {
        console.error('Error cargando estudiantes:', e);
        if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--danger);padding:2rem;">Error al cargar estudiantes.</p>';
        if (loading) loading.style.display = 'none';
    }
}

function inicializarRealtimeEstudiantes() {
    if (!supabaseClient) return;
    if (estudiantesListener) supabaseClient.removeChannel(estudiantesListener);
    estudiantesListener = supabaseClient.channel('estudiantes-realtime')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'estudiantes' }, () => { cargarEstudiantes(); })
        .subscribe();
}

function renderEstudiantes() {
    if (supabaseClient) { cargarEstudiantes(); inicializarRealtimeEstudiantes(); }
    else {
        setTimeout(() => {
            if (supabaseClient) { cargarEstudiantes(); inicializarRealtimeEstudiantes(); }
            else { document.getElementById('estudiantes-grid').innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--danger);padding:2rem;">Error de conexión con Supabase.</p>'; }
        }, 1500);
    }
}

// ============================================
// ENCABEZADO DINÁMICO DE ESTUDIANTES
// ============================================
function actualizarEncabezadoEstudiantes() {
    const perfil        = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const headerUnirse  = document.getElementById('estudiantes-header-unirse');
    const headerMiembro = document.getElementById('estudiantes-header-miembro');
    const miCardEl      = document.getElementById('mi-card-estudiante');

    if (!perfil || !perfil.supabase_registered) {
        if (headerUnirse)  headerUnirse.style.display  = 'flex';
        if (headerMiembro) headerMiembro.style.display = 'none';
        return;
    }

    if (headerUnirse)  headerUnirse.style.display  = 'none';
    if (headerMiembro) headerMiembro.style.display = 'block';

    if (miCardEl && perfil) {
        const fecha = perfil.fecha_registro || '—';
        const tieneFotoMenu = !!(perfil.foto_url && perfil.foto_url.trim() !== '');
        miCardEl.innerHTML = `
            <div class="mi-card-header-row">
                <div class="mi-card-wrapper">
                  <div class="mi-card-foto-wrap">
                <img src="${perfil.foto_url || ''}"
                     alt="${perfil.nombre || ''}"
                     class="mi-card-foto"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre || '?')}&background=3b82f6&color=fff&size=200'">
                <button class="mi-card-lapiz" title="Opciones de foto"
                        onclick="event.stopPropagation(); toggleMenuFotoMiCard()">
                    <i class="fa-solid fa-pencil"></i>
                </button>
              ${tieneFotoMenu ? `
            <div class="mi-card-menu-foto" id="mi-card-menu-foto" style="display:none;">
                <button onclick="verFotoMiPerfil()">
                    <i class="fa-solid fa-eye"></i> Ver foto
                </button>
                <hr>
                <button onclick="document.getElementById('mi-card-foto-input').click(); cerrarMenuFotoMiCard()">
                    <i class="fa-solid fa-camera"></i> Cambiar foto
                </button>
                <hr>
                <button class="btn-eliminar-foto" onclick="eliminarFotoMiPerfil()">
                    <i class="fa-solid fa-trash"></i> Eliminar foto
                </button>
            </div>
            ` : `
            <div class="mi-card-menu-foto" id="mi-card-menu-foto" style="display:none;">
                <button onclick="document.getElementById('mi-card-foto-input').click(); cerrarMenuFotoMiCard()">
                    <i class="fa-solid fa-camera"></i> Subir foto
                </button>
            </div>
            `}
            </div>
            <input type="file" id="mi-card-foto-input" accept="image/*"
                   style="display:none;" onchange="procesarNuevaFotoPerfil(event)">
                    <div class="mi-card-info">
                        <span class="mi-card-nombre">${perfil.nombre || '—'}</span>
                        <div class="mi-card-badges">
                            <span class="mi-card-badge-esp">
                                <i class="fa-solid fa-graduation-cap"></i> ${perfil.especialidad || '—'}
                            </span>
                            <span class="mi-card-badge-ciclo">Ciclo ${perfil.ciclo || '—'}</span>
                        </div>
                        <span class="mi-card-fecha">
                            <i class="fa-solid fa-calendar-check"></i> ${fecha}
                        </span>
                    </div>
                    <span class="mi-card-tag">
                        <i class="fa-solid fa-check-circle"></i> Miembro
                    </span>
                </div>
                <div class="mi-card-btns-col">
                    <button class="btn-solicitudes" id="btn-solicitudes" onclick="abrirSolicitudes()">
                        <i class="fa-solid fa-user-clock"></i> Solicitudes
                    </button>
                    <button class="btn-amigos" id="btn-amigos" onclick="abrirAmigos()">
                        <i class="fa-solid fa-user-friends"></i> Amigos
                    </button>
                </div>
            </div>
        `;
        iniciarListenerSolicitudes();
    }
}

// ============================================
// PERFIL EN SIDEBAR
// ============================================
function actualizarPerfilSidebar() {
    const perfil  = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const wrapper = document.getElementById('sidebar-profile-wrapper');
    if (!wrapper) return;
    if (!perfil) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = 'flex';
    const img     = document.getElementById('sidebar-profile-img');
    const initial = document.getElementById('sidebar-profile-initial');
    if (perfil.foto_url && img) {
        img.src = perfil.foto_url; img.style.display = 'block';
        if (initial) initial.style.display = 'none';
    } else if (initial) {
        initial.textContent = (perfil.nombre || '?')[0].toUpperCase();
        initial.style.display = 'flex'; if (img) img.style.display = 'none';
    }
    if (perfil.especialidad) aplicarTemaEspecialidad(perfil.especialidad);

    // Mostrar ajustes en todos los dispositivos
    const ajustesWrapper = document.getElementById('sidebar-ajustes-wrapper');
    if (ajustesWrapper) {
        ajustesWrapper.style.display = 'block';
        // "Vincular Escritorio" solo visible en móvil
        const btnVincular = document.getElementById('btn-vincular-escritorio');
        if (btnVincular) {
            btnVincular.style.display = getDeviceType() === 'mobile' ? 'flex' : 'none';
        }
    }
}

function abrirPerfilEstudiante() {
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const modal  = document.getElementById('modal-perfil-estudiante');
    if (!modal) return;
    if (!perfil) { openRegistroModal(); return; }
    document.getElementById('perfil-modal-nombre').textContent       = perfil.nombre;
    document.getElementById('perfil-modal-especialidad').textContent = perfil.especialidad || '—';
    document.getElementById('perfil-modal-ciclo').textContent        = perfil.ciclo ? `Ciclo ${perfil.ciclo}` : '—';
    const img = document.getElementById('perfil-modal-foto');
    if (img) {
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre || 'Usuario')}&background=3b82f6&color=fff&size=200`;
        img.src     = perfil.foto_url || fallback;
        img.onerror = function() { this.src = fallback; this.onerror = null; };
    }
   modal.style.display = 'flex';

    const btnCambiarFoto = document.getElementById('btn-cambiar-foto-sidebar');
    if (btnCambiarFoto) {
        const tieneFoto = !!(perfil.foto_url && perfil.foto_url.trim() !== '');
        btnCambiarFoto.innerHTML = tieneFoto
            ? '<i class="fa-solid fa-camera"></i> Cambiar foto'
            : '<i class="fa-solid fa-camera"></i> Subir foto';
    }
}

function cambiarFotoSidebar() { const input = document.getElementById('sidebar-foto-file-input'); if (input) input.click(); }

async function procesarNuevaFotoPerfil(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('⚠️ La imagen es muy grande. Máximo 5MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('⚠️ Selecciona un archivo de imagen válido.'); return; }
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (!perfil) { alert('❌ No se encontró tu perfil.'); return; }

    mostrarSkeletonFoto();

    const reader = new FileReader();
    reader.onload = function(e) {
        const imgModal   = document.getElementById('perfil-modal-foto');
        const imgSidebar = document.getElementById('sidebar-profile-img');
        const initial    = document.getElementById('sidebar-profile-initial');
        if (imgModal)   { imgModal.src = e.target.result; }
        if (imgSidebar) { imgSidebar.src = e.target.result; imgSidebar.style.display = 'block'; }
        if (initial)    { initial.style.display = 'none'; }
        // mostrarSkeletonFoto() ← ELIMINAR esta línea que estaba aquí
    };
    reader.readAsDataURL(file);

    const btnCambiar = document.getElementById('btn-cambiar-foto-sidebar');
    if (btnCambiar) { btnCambiar.disabled = true; btnCambiar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...'; }
    try {
        const formData = new FormData();
        formData.append('file', file); formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET); formData.append('folder', 'estudiantes_clouddesk');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
        if (!res.ok) throw new Error('Error al subir la imagen');
        const data = await res.json(); const nuevaUrl = data.secure_url;

        // ocultarSkeletonFoto() ← ELIMINAR esta línea que estaba aquí
        const imgMiCard = document.querySelector('.mi-card-foto');
        if (imgMiCard) imgMiCard.src = nuevaUrl;

        if (perfil.foto_url && perfil.foto_url !== nuevaUrl) {
            eliminarImagenCloudinary(perfil.foto_url).catch(console.error);
        }

        if (supabaseClient && perfil.supabase_registered) {
            const { error } = await supabaseClient
                .from('estudiantes')
                .update({ foto_url: nuevaUrl })
                .eq('nombre_completo', perfil.nombre);
            if (error) console.warn('No se actualizó en Supabase:', error.message);
            else cargarEstudiantes();
        }

        const authData = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');
        if (authData.codigo) await _savePerfilToFirebase(authData.codigo, { ...perfil, foto_url: nuevaUrl }).catch(console.error);

        perfil.foto_url = nuevaUrl;
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));

        actualizarPerfilSidebar();
        actualizarEncabezadoEstudiantes();
        ocultarSkeletonFoto();
        mostrarToast('✅ Foto actualizada correctamente');
    } catch(err) {
        ocultarSkeletonFoto();
        // ocultarSkeletonFoto() ← ELIMINAR esta línea que estaba aquí
        console.error(err); alert('❌ Error al actualizar la foto: ' + err.message);
    } finally {
        if (btnCambiar) { btnCambiar.disabled = false; btnCambiar.innerHTML = '<i class="fa-solid fa-camera"></i> Cambiar foto'; }
        event.target.value = '';
    }
}

function cerrarPerfilEstudiante() { const modal = document.getElementById('modal-perfil-estudiante'); if (modal) modal.style.display = 'none'; }

// ============================================
// SIDEBAR Y NAVEGACIÓN
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    if (window.innerWidth <= 768) overlay.classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function switchTab(tab) {
    currentTab = tab; showingFinalizados = false;
    if (window.innerWidth <= 768) closeSidebar();

    sectionRepositorio.style.display = 'none';
    sectionTrabajos.style.display    = 'none';
    sectionRecursos.style.display    = 'none';
    if (sectionLibros)  sectionLibros.style.display  = 'none';
    sectionDocentes.style.display    = 'none';
    sectionEstudiantes.style.display = 'none';
    if (sectionChat) sectionChat.style.display = 'none';
    

    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));

    const searchInputRepo = document.getElementById('searchInputRepositorio');
    const searchInputRec  = document.getElementById('searchInputRecursos');
    if (searchInputRepo) searchInputRepo.value = '';
    if (searchInputRec)  searchInputRec.value  = '';

    if (tab === 'repositorio') {
        sectionRepositorio.style.display = 'block';
        document.getElementById('tab-repositorio').classList.add('active');
        renderFiles();
    } else if (tab === 'trabajos') {
        sectionTrabajos.style.display = 'block';
        document.getElementById('tab-trabajos').classList.add('active');
        trabajosPendientesSection.style.display  = 'block';
        trabajosFinalizadosSection.style.display = 'none';
        const btn = document.getElementById('btn-trabajos-finalizados');
        if (btn) {
            const btnIcon = btn.querySelector('i'); const btnTextSpan = document.getElementById('btn-trabajos-text');
            if (btnTextSpan) btnTextSpan.textContent = 'Ver trabajos finalizados';
            if (btnIcon)     btnIcon.className        = 'fa-solid fa-check-circle';
            btn.classList.remove('showing-finalizados');
        }
        renderAssignments();
   } else if (tab === 'recursos') {
    sectionRecursos.style.display = 'block';
    document.getElementById('tab-recursos').classList.add('active');
    // Asegurar que el primer botón esté activo
    currentRecursosTipo = 'Documentos';
    document.querySelectorAll('.recursos-tipo-btn').forEach(b => b.classList.remove('active'));
    const rtbtn = document.getElementById('rtbtn-Documentos');
    if (rtbtn) rtbtn.classList.add('active');
    renderRecursosContent();

} else if (tab === 'libros') {
    if (sectionLibros) sectionLibros.style.display = 'block';
    const tabLibros = document.getElementById('tab-libros');
    if (tabLibros) tabLibros.classList.add('active');
    // Resetear filtro a "Todo" cada vez que entras
    currentLibrosCategoria = 'Todo';
    document.querySelectorAll('.libros-filter-btn').forEach(b => b.classList.remove('active'));
    const lbtnTodo = document.getElementById('lbtn-Todo');
    if (lbtnTodo) lbtnTodo.classList.add('active');
    cargarLibros();
    } else if (tab === 'docentes') {
        sectionDocentes.style.display = 'block';
        document.getElementById('tab-docentes').classList.add('active');
        renderDocentes();
    } else if (tab === 'estudiantes') {
        sectionEstudiantes.style.display = 'block';
        document.getElementById('tab-estudiantes').classList.add('active');
        actualizarEncabezadoEstudiantes();
        renderEstudiantes();
    } else if (tab === 'chat') {
        if (sectionChat) sectionChat.style.display = 'block';
        const tabChat = document.getElementById('tab-chat');
        if (tabChat) tabChat.classList.add('active');
        iniciarListenerChats();
    }
}

// ============================================
// CLOUDINARY — ELIMINAR IMAGEN VIA SUPABASE
// ============================================
function getCloudinaryPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : null;
}

async function eliminarImagenCloudinary(url) {
    const publicId = getCloudinaryPublicId(url);
    if (!publicId) return;
    try {
        const res = await fetch(
            `${SUPABASE_CONFIG.URL}/functions/v1/eliminar-foto`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${SUPABASE_CONFIG.KEY}`
                },
                body: JSON.stringify({ public_id: publicId })
            }
        );
        await res.json();
    } catch(e) {
        console.error('Error eliminando imagen de Cloudinary:', e);
    }
}
// ============================================
// CHAT Y SOLICITUDES — SISTEMA COMPLETO
// ============================================

function toKey(nombre) {
    return (nombre || '').trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

function getChatId(keyA, keyB) { return [keyA, keyB].sort().join('__'); }
function getMiPerfil() { return JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null'); }
function getMiKey() {
    const p = getMiPerfil();
    return (p && p.supabase_registered) ? toKey(p.nombre) : null;
}

async function getEstadoAmistad(otroKey) {
    const miKey = getMiKey();
    if (!miKey || miKey === otroKey) return null;
    try {
        const [amigoSnap, enviadaSnap, recibidaSnap] = await Promise.all([
            database.ref(`amigos/${miKey}/${otroKey}`).once('value'),
            database.ref(`solicitudes_enviadas/${miKey}/${otroKey}`).once('value'),
            database.ref(`solicitudes/${miKey}/pendientes/${otroKey}`).once('value')
        ]);
        if (amigoSnap.exists())    return 'amigo';
        if (enviadaSnap.exists())  return 'enviada';
        if (recibidaSnap.exists()) return 'recibida';
    } catch(e) { console.error('getEstadoAmistad:', e); }
    return null;
}

async function actualizarEstadoBtnSolicitud(otroKey, btnId) {
    const miKey = getMiKey();
    if (!miKey) return;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    try {
        const estado = await getEstadoAmistad(otroKey);
        if (estado === 'amigo') {
            btn.innerHTML   = '<i class="fa-solid fa-user-check"></i>';
            btn.style.color = 'var(--success)'; btn.title = 'Ya son amigos'; btn.classList.add('amigo');
        } else if (estado === 'enviada') {
            btn.innerHTML   = '<i class="fa-solid fa-user-clock"></i>';
            btn.style.color = 'var(--primary-color)'; btn.title = 'Solicitud enviada'; btn.classList.add('enviada');
        } else if (estado === 'recibida') {
            btn.innerHTML   = '<i class="fa-solid fa-user-plus"></i>';
            btn.style.color = 'var(--warning)'; btn.title = 'Esta persona te envió solicitud — clic para aceptar'; btn.classList.add('recibida');
        }
    } catch(e) { console.error('Error actualizarEstadoBtnSolicitud:', e); }
}

async function manejarBtnSolicitud(otroKey, otroNombre, otroFoto, otroEsp, otroCiclo, btnEl) {
    const miKey = getMiKey();
    if (!miKey) { mostrarToast('⚠️ Únete a la comunidad primero', 'fa-exclamation-circle'); return; }
    if (miKey === otroKey) return;
    btnEl.disabled = true;
    const estado = await getEstadoAmistad(otroKey);
    if (estado === 'amigo')   { mostrarToast('Ya son amigos', 'fa-user-check'); btnEl.disabled = false; return; }
    if (estado === 'enviada') { mostrarToast('Solicitud ya enviada', 'fa-user-clock'); btnEl.disabled = false; return; }
    if (estado === 'recibida') {
        await _aceptarInternamente(otroKey, otroNombre, otroFoto);
        btnEl.innerHTML = '<i class="fa-solid fa-user-check"></i>'; btnEl.style.color = 'var(--success)';
        btnEl.classList.remove('recibida'); btnEl.classList.add('amigo');
        mostrarToast(`✅ ¡Ahora son amigos!`); btnEl.disabled = false; return;
    }
    try {
        const miPerfil = getMiPerfil();
        await database.ref(`solicitudes/${otroKey}/pendientes/${miKey}`).set({
            nombre: miPerfil.nombre, foto: miPerfil.foto_url || '',
            especialidad: miPerfil.especialidad || '', ciclo: miPerfil.ciclo || '', fecha: Date.now()
        });
        await database.ref(`solicitudes_enviadas/${miKey}/${otroKey}`).set(true);
        btnEl.innerHTML = '<i class="fa-solid fa-user-clock"></i>'; btnEl.style.color = 'var(--primary-color)';
        btnEl.classList.add('enviada'); btnEl.title = 'Solicitud enviada';
        mostrarToast('✅ Solicitud enviada');
    } catch(e) { console.error('Error enviando solicitud:', e); mostrarToast('❌ Error al enviar solicitud', 'fa-times-circle'); }
    btnEl.disabled = false;
}

function abrirSolicitudes() {
    const overlay = document.getElementById('solicitudes-overlay');
    if (overlay) { overlay.style.display = 'flex'; cargarSolicitudesPanel(); }
}
function cerrarSolicitudes() { const overlay = document.getElementById('solicitudes-overlay'); if (overlay) overlay.style.display = 'none'; }

async function cargarSolicitudesPanel() {
    const lista = document.getElementById('solicitudes-lista');
    if (!lista) return;
    lista.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</p>';
    const miKey = getMiKey();
    if (!miKey) return;
    try {
        const snap      = await database.ref(`solicitudes/${miKey}/pendientes`).once('value');
        const pendientes = snap.val();
        if (!pendientes || !Object.keys(pendientes).length) {
            lista.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Sin solicitudes pendientes.</p>'; return;
        }
        lista.innerHTML = '';
        for (const [fromKey, data] of Object.entries(pendientes)) {
            const item = document.createElement('div'); item.className = 'solicitud-item';
            item.innerHTML = `
                <img src="${data.foto || ''}" alt="${data.nombre}" class="solicitud-foto"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(data.nombre)}&background=3b82f6&color=fff&size=200'">
                <div class="solicitud-info">
                    <div class="solicitud-nombre">${data.nombre}</div>
                    <div class="solicitud-esp">${data.especialidad || ''} · Ciclo ${data.ciclo || ''}</div>
                </div>
                <div class="solicitud-actions">
                    <button class="btn-aceptar" id="btn-ac-${fromKey}"><i class="fa-solid fa-check"></i></button>
                    <button class="btn-rechazar" id="btn-re-${fromKey}"><i class="fa-solid fa-times"></i></button>
                </div>`;
            lista.appendChild(item);
            document.getElementById(`btn-ac-${fromKey}`).addEventListener('click', async () => {
                await _aceptarInternamente(fromKey, data.nombre, data.foto || '');
                mostrarToast(`✅ ¡Ahora eres amigo/a de ${data.nombre}!`);
                cargarSolicitudesPanel(); cargarListaChats();
                const btnGrid = document.getElementById(`btn-sol-${fromKey}`);
                if (btnGrid) { btnGrid.innerHTML = '<i class="fa-solid fa-user-check"></i>'; btnGrid.style.color = 'var(--success)'; btnGrid.classList.remove('recibida'); btnGrid.classList.add('amigo'); }
            });
            document.getElementById(`btn-re-${fromKey}`).addEventListener('click', async () => {
                await database.ref(`solicitudes/${miKey}/pendientes/${fromKey}`).remove();
                await database.ref(`solicitudes_enviadas/${fromKey}/${miKey}`).remove();
                cargarSolicitudesPanel();
            });
        }
    } catch(e) { console.error('Error cargando solicitudes:', e); lista.innerHTML = '<p style="text-align:center;color:var(--danger);padding:2rem;">Error al cargar.</p>'; }
}

async function _aceptarInternamente(fromKey, fromNombre, fromFoto) {
    const miKey = getMiKey(); const miPerfil = getMiPerfil();
    if (!miKey || !miPerfil) return;
    const chatId = getChatId(miKey, fromKey);
    try {
        const updates = {};
        updates[`amigos/${miKey}/${fromKey}`]      = { nombre: fromNombre, foto: fromFoto };
        updates[`amigos/${fromKey}/${miKey}`]      = { nombre: miPerfil.nombre, foto: miPerfil.foto_url || '' };
        updates[`chats/${chatId}/info/${miKey}`]   = { nombre: miPerfil.nombre, foto: miPerfil.foto_url || '' };
        updates[`chats/${chatId}/info/${fromKey}`] = { nombre: fromNombre, foto: fromFoto };
        updates[`solicitudes/${miKey}/pendientes/${fromKey}`]  = null;
        updates[`solicitudes_enviadas/${fromKey}/${miKey}`]    = null;
        await database.ref().update(updates);
    } catch(e) { console.error('Error en _aceptarInternamente:', e); }
}

let _solicitudesNotifRef = null;

function iniciarListenerSolicitudes() {
    const miKey = getMiKey(); if (!miKey) return;
    if (_solicitudesNotifRef) _solicitudesNotifRef.off('value');
    _solicitudesNotifRef = database.ref(`solicitudes/${miKey}/pendientes`);
    _solicitudesNotifRef.on('value', (snap) => {
        const count  = snap.val() ? Object.keys(snap.val()).length : 0;
        const btnSol = document.getElementById('btn-solicitudes');
        if (!btnSol) return;
        const dotExistente = btnSol.querySelector('.notif-dot');
        if (dotExistente) dotExistente.remove();
        if (count > 0) { const nd = document.createElement('span'); nd.className = 'notif-dot'; btnSol.appendChild(nd); }
    });
}

let _chatActivoId        = null;
let _chatActivoOtroKey   = null;
let _mensajesListenerRef = null;
let _amigosListenerRef   = null;

async function cargarListaChats() {
    const chatList   = document.getElementById('chat-list');
    if (!chatList) return;
    const miKey = getMiKey(); const miPerfil = getMiPerfil();
    if (!miKey || !miPerfil?.supabase_registered) {
        chatList.innerHTML = '<p class="chat-empty"><i class="fa-solid fa-user-lock"></i><br>Únete a la comunidad para chatear.</p>';
        return;
    }
    try {
        const snap   = await database.ref(`amigos/${miKey}`).once('value');
        const amigos = snap.val();
        if (!amigos || !Object.keys(amigos).length) {
            chatList.innerHTML = '<p class="chat-empty"><i class="fa-solid fa-comment-slash"></i><br>No tienes contactos aún.<br>Acepta solicitudes en Comunidad.</p>';
            return;
        }
        chatList.innerHTML = '';
        for (const [amigoKey, amigoData] of Object.entries(amigos)) {
            const chatId = getChatId(miKey, amigoKey);
            let ultimoTxt = 'Sin mensajes aún';
            try { const ultSnap = await database.ref(`chats/${chatId}/ultimo_mensaje`).once('value'); if (ultSnap.val()) ultimoTxt = ultSnap.val().texto; } catch(e) {}
            const item = document.createElement('div'); item.className = 'chat-item'; item.id = `chat-item-${amigoKey}`;
            item.innerHTML = `
                <img src="${amigoData.foto || ''}" alt="${amigoData.nombre}" class="chat-item-foto"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(amigoData.nombre)}&background=3b82f6&color=fff&size=200'">
                <div class="chat-item-info">
                    <span class="chat-item-nombre">${amigoData.nombre}</span>
                    <span class="chat-item-ultimo">${ultimoTxt}</span>
                </div>`;
            item.addEventListener('click', () => { abrirChatConAmigo(chatId, amigoKey, amigoData.nombre, amigoData.foto || ''); });
            chatList.appendChild(item);
        }
    } catch(e) { console.error('Error cargando lista chats:', e); }
}

function iniciarListenerChats() {
    const miKey = getMiKey(); if (!miKey) return;
    if (_amigosListenerRef) _amigosListenerRef.off('value');
    _amigosListenerRef = database.ref(`amigos/${miKey}`);
    _amigosListenerRef.on('value', () => { if (currentTab === 'chat') cargarListaChats(); });
}

function abrirChatConAmigo(chatId, otroKey, otroNombre, otroFoto) {
    _chatActivoId = chatId; _chatActivoOtroKey = otroKey;
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    const item = document.getElementById(`chat-item-${otroKey}`);
    if (item) item.classList.add('active');
    if (window.innerWidth <= 768) {
        const sp = document.getElementById('chat-sidebar-panel');
        const cm = document.getElementById('chat-main');
        if (sp) sp.style.display = 'none';
        if (cm) { cm.style.display = 'flex'; cm.classList.add('mobile-visible'); }
    }
    const placeholder = document.getElementById('chat-placeholder');
    const chatWindow  = document.getElementById('chat-window');
    if (placeholder) placeholder.style.display = 'none';
    if (chatWindow)  chatWindow.style.display   = 'flex';

    const isMobile = window.innerWidth <= 768;
    const winHeader = document.getElementById('chat-win-header');
    if (winHeader) {
        winHeader.innerHTML = `
            ${isMobile ? `<button class="chat-back-btn" onclick="volverListaChats()"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
            <img src="${otroFoto}" alt="${otroNombre}" class="chat-header-foto"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(otroNombre)}&background=3b82f6&color=fff&size=200'">
            <span class="chat-header-nombre">${otroNombre}</span>
            <button class="btn-denunciar-chat" onclick="abrirDenuncia('${otroNombre.replace(/'/g,"\\'")}')">
                <i class="fa-solid fa-flag"></i><span class="btn-den-txt"> Denunciar</span>
            </button>`;
    }

    if (_mensajesListenerRef) { _mensajesListenerRef.off('child_added'); _mensajesListenerRef = null; }
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) messagesEl.innerHTML = '';

    const miKey = getMiKey();
    _mensajesListenerRef = database.ref(`chats/${chatId}/mensajes`);
    _mensajesListenerRef.on('child_added', (snap) => {
        const msg = snap.val();
        if (!msg || !messagesEl) return;
        const esMio = msg.de_key === miKey;
        const hora  = msg.fecha ? new Date(msg.fecha).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : '';
        const wrap = document.createElement('div');
        wrap.className = `chat-bubble-wrapper ${esMio ? 'mio' : 'otro'}`;
        wrap.innerHTML = `<div class="chat-bubble ${esMio ? 'mio' : 'otro'}">${msg.texto}<div class="chat-bubble-time">${hora}</div></div>`;
        messagesEl.appendChild(wrap);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
    setTimeout(() => document.getElementById('chat-input')?.focus(), 100);
}

function volverListaChats() {
    const sp = document.getElementById('chat-sidebar-panel');
    const cm = document.getElementById('chat-main');
    if (sp) sp.style.display = 'flex';
    if (cm) { cm.style.display = 'none'; cm.classList.remove('mobile-visible'); }
    const placeholder = document.getElementById('chat-placeholder');
    const chatWindow  = document.getElementById('chat-window');
    if (chatWindow)  chatWindow.style.display   = 'none';
    if (placeholder) placeholder.style.display  = 'flex';
    if (_mensajesListenerRef) { _mensajesListenerRef.off('child_added'); _mensajesListenerRef = null; }
    _chatActivoId = null; _chatActivoOtroKey = null;
}

async function enviarMensaje() {
    const input = document.getElementById('chat-input');
    const texto = input?.value?.trim();
    if (!texto || !_chatActivoId) return;
    const miPerfil = getMiPerfil(); const miKey = getMiKey();
    if (!miPerfil || !miKey) return;
    input.value = '';
    try {
        const msg = { de_key: miKey, de_nombre: miPerfil.nombre, texto, fecha: Date.now() };
        await database.ref(`chats/${_chatActivoId}/mensajes`).push(msg);
        await database.ref(`chats/${_chatActivoId}/ultimo_mensaje`).set({ texto, fecha: Date.now(), de_key: miKey });
        const itemUlt = document.querySelector(`#chat-item-${_chatActivoOtroKey} .chat-item-ultimo`);
        if (itemUlt) itemUlt.textContent = texto;
    } catch(e) { console.error('Error enviando mensaje:', e); }
}

if ('visualViewport' in window) {
    window.visualViewport.addEventListener('resize', () => {
        const chatMain = document.getElementById('chat-main');
        if (!chatMain || !chatMain.classList.contains('mobile-visible')) return;
        const vv = window.visualViewport;
        chatMain.style.height = vv.height + 'px';
        chatMain.style.top    = vv.offsetTop + 'px';
    });
}

function abrirAmigos() { const overlay = document.getElementById('amigos-overlay'); if (overlay) { overlay.style.display = 'flex'; cargarAmigosPanel(); } }
function cerrarAmigos() { const overlay = document.getElementById('amigos-overlay'); if (overlay) overlay.style.display = 'none'; }

async function cargarAmigosPanel() {
    const lista = document.getElementById('amigos-lista'); if (!lista) return;
    lista.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</p>';
    const miKey = getMiKey(); if (!miKey) return;
    try {
        const snap = await database.ref(`amigos/${miKey}`).once('value');
        const amigos = snap.val();
        if (!amigos || !Object.keys(amigos).length) { lista.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Sin amigos aún.</p>'; return; }
        lista.innerHTML = '';
        for (const [amigoKey, amigoData] of Object.entries(amigos)) {
            const item = document.createElement('div'); item.className = 'amigo-item';
            item.innerHTML = `
                <img src="${amigoData.foto || ''}" alt="${amigoData.nombre}" class="amigo-foto"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(amigoData.nombre)}&background=10b981&color=fff&size=200'">
                <div class="amigo-info"><div class="amigo-nombre">${amigoData.nombre}</div></div>
                <button class="btn-eliminar-amigo" id="btn-del-${amigoKey}"><i class="fa-solid fa-user-minus"></i> Eliminar</button>`;
            item.querySelector(`#btn-del-${amigoKey}`).addEventListener('click', () => { eliminarAmigo(amigoKey, amigoData.nombre); });
            lista.appendChild(item);
        }
    } catch(e) { console.error('Error cargando amigos:', e); lista.innerHTML = '<p style="text-align:center;color:var(--danger);padding:2rem;">Error al cargar.</p>'; }
}

async function eliminarAmigo(amigoKey, amigoNombre) {
    const confirmar = confirm(`¿Seguro que quieres eliminar a "${amigoNombre}"?`);
    if (!confirmar) return;
    const miKey = getMiKey(); if (!miKey) return;
    const chatId = getChatId(miKey, amigoKey);
    try {
        const updates = {};
        updates[`amigos/${miKey}/${amigoKey}`] = null; updates[`amigos/${amigoKey}/${miKey}`] = null;
        updates[`chats/${chatId}`] = null;
        updates[`solicitudes_enviadas/${miKey}/${amigoKey}`]  = null; updates[`solicitudes_enviadas/${amigoKey}/${miKey}`]  = null;
        updates[`solicitudes/${miKey}/pendientes/${amigoKey}`] = null; updates[`solicitudes/${amigoKey}/pendientes/${miKey}`] = null;
        await database.ref().update(updates);
        mostrarToast(`✅ "${amigoNombre}" eliminado de tus amigos`);
        if (_chatActivoOtroKey === amigoKey) volverListaChats();
        cargarAmigosPanel(); cargarListaChats(); cargarEstudiantes();
    } catch(e) { console.error('Error eliminando amigo:', e); mostrarToast('❌ Error al eliminar amigo', 'fa-times-circle'); }
}

// ============================================
// CICLOS POR ESPECIALIDAD Y TEMA
// ============================================
const CICLOS_POR_ESPECIALIDAD = {
    'Comunicación': ['V', 'VII'],
    'Inicial':      ['III', 'V', 'VII']
};

function onEspecialidadAuthCambio() {
    const esp    = document.getElementById('selectEspecialidad')?.value;
    const select = document.getElementById('selectCiclo');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Elige ciclo</option>';
    const ciclos = CICLOS_POR_ESPECIALIDAD[esp] || [];
    ciclos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        select.appendChild(opt);
    });
    aplicarTemaEspecialidad(esp);
}

function aplicarTemaEspecialidad(especialidad) {
    document.body.classList.remove('tema-inicial', 'tema-comunicacion');
    if (especialidad === 'Inicial') {
        document.body.classList.add('tema-inicial');
    }
}

// ============================================
// SISTEMA DE DENUNCIAS
// ============================================
let _denEvidFile    = null;
let _denEvidTipo    = 'foto';
let _denAudioBlob   = null;
let _denMediaRec    = null;
let _denAudioChunks = [];
let _denGrabando    = false;
let _denTimerIntvl  = null;
let _denTimerSecs   = 0;

function abrirDenuncia(nombrePrerellenado) {
    _denEvidFile = null; _denAudioBlob = null; _denAudioChunks = [];
    _denGrabando = false; _denEvidTipo = 'foto';
    if (_denTimerIntvl) { clearInterval(_denTimerIntvl); _denTimerIntvl = null; }
    const ahora = new Date();
    document.getElementById('denuncia-nombre').value      = nombrePrerellenado || '';
    document.getElementById('denuncia-cargo').value       = '';
    document.getElementById('denuncia-ciclo').value       = '';
    const espEl = document.getElementById('denuncia-especialidad');
    if (espEl) espEl.value = '';
    const rowEst = document.getElementById('denuncia-estudiante-row');
    if (rowEst) rowEst.style.display = 'none';
    document.getElementById('denuncia-descripcion').value = '';
    document.getElementById('denuncia-terminos-check').checked = false;
    document.getElementById('denuncia-fecha').value = ahora.toISOString().split('T')[0];
    document.getElementById('denuncia-hora').value  = ahora.toTimeString().substring(0,5);
    document.getElementById('den-ev-preview').innerHTML  = '';
    document.getElementById('den-ev-preview').style.display = 'none';
    document.getElementById('den-audio-preview').innerHTML  = '';
    document.getElementById('den-audio-preview').style.display = 'none';
    ['ev-input-foto','ev-input-video','ev-input-audio'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const btnGrab = document.getElementById('btn-grabar-den');
    const btnStop = document.getElementById('btn-detener-den');
    const timer   = document.getElementById('den-timer');
    if (btnGrab) btnGrab.style.display = 'flex';
    if (btnStop) btnStop.style.display = 'none';
    if (timer)   timer.style.display   = 'none';
    selTabEv('foto');
    _mostrarDenStep(1);
    document.getElementById('denunciaModal').style.display = 'block';
}

function _mostrarDenStep(n) {
    ['denuncia-step-terms','denuncia-step-form','denuncia-step-success'].forEach((id, i) => {
        document.getElementById(id).style.display = (i + 1 === n) ? 'block' : 'none';
    });
}

function continuarAFormulario() {
    if (!document.getElementById('denuncia-terminos-check').checked) {
        mostrarToast('⚠️ Debes aceptar los términos para continuar', 'fa-exclamation-circle'); return;
    }
    _mostrarDenStep(2);
}

function closeDenunciaModal() {
    document.getElementById('denunciaModal').style.display = 'none';
    if (_denMediaRec && _denMediaRec.state !== 'inactive') _denMediaRec.stop();
    if (_denTimerIntvl) { clearInterval(_denTimerIntvl); _denTimerIntvl = null; }
}

function onCargoCambio() {
    const v = document.getElementById('denuncia-cargo').value;
    const isEst = v === 'Estudiante';
    const rowEst = document.getElementById('denuncia-estudiante-row');
    if (rowEst) rowEst.style.display = isEst ? 'grid' : 'none';
    if (!isEst) {
        const espEl = document.getElementById('denuncia-especialidad');
        const cicEl = document.getElementById('denuncia-ciclo');
        if (espEl) espEl.value = ''; if (cicEl) cicEl.value = '';
    }
}

function selTabEv(tipo) {
    _denEvidTipo = tipo;
    ['foto','video','audio'].forEach(t => {
        document.getElementById(`tab-ev-${t}`).classList.toggle('active', t === tipo);
        document.getElementById(`ev-panel-${t}`).style.display = t === tipo ? 'block' : 'none';
    });
}

function onEvFile(event, tipo) {
    const file = event.target.files[0]; if (!file) return;
    _denEvidFile = file; _denEvidTipo = tipo;
    const preview    = document.getElementById('den-ev-preview');
    const audPreview = document.getElementById('den-audio-preview');
    if (tipo === 'foto') {
        const reader = new FileReader();
        reader.onload = e => {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:140px;border-radius:8px;margin-top:0.5rem;display:block;">
            <p style="color:var(--success);font-size:0.8rem;text-align:center;margin-top:4px;"><i class="fa-solid fa-check-circle"></i> ${file.name}</p>`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else if (tipo === 'video') {
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<video src="${url}" controls style="max-width:100%;max-height:140px;border-radius:8px;margin-top:0.5rem;display:block;"></video>
        <p style="color:var(--success);font-size:0.8rem;text-align:center;margin-top:4px;"><i class="fa-solid fa-check-circle"></i> ${file.name}</p>`;
        preview.style.display = 'block';
    } else if (tipo === 'audio') {
        const url = URL.createObjectURL(file);
        audPreview.innerHTML = `<audio controls src="${url}" style="width:100%;margin-top:0.5rem;"></audio>
        <p style="color:var(--success);font-size:0.8rem;text-align:center;margin-top:4px;"><i class="fa-solid fa-check-circle"></i> ${file.name}</p>`;
        audPreview.style.display = 'block';
        _denAudioBlob = null;
    }
}

async function iniciarGrabacion() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _denAudioChunks = [];
        _denMediaRec = new MediaRecorder(stream);
        _denMediaRec.ondataavailable = e => _denAudioChunks.push(e.data);
        _denMediaRec.onstop = () => {
            _denAudioBlob = new Blob(_denAudioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(_denAudioBlob);
            const prev = document.getElementById('den-audio-preview');
            prev.innerHTML = `<audio controls src="${url}" style="width:100%;margin-top:0.5rem;"></audio>
            <p style="color:var(--success);font-size:0.8rem;text-align:center;margin-top:4px;"><i class="fa-solid fa-check-circle"></i> Audio grabado</p>`;
            prev.style.display = 'block';
            stream.getTracks().forEach(t => t.stop());
        };
        _denMediaRec.start(); _denGrabando = true; _denTimerSecs = 0;
        document.getElementById('btn-grabar-den').style.display  = 'none';
        document.getElementById('btn-detener-den').style.display = 'flex';
        document.getElementById('den-timer').style.display       = 'inline-block';
        _denTimerIntvl = setInterval(() => {
            _denTimerSecs++;
            const m = String(Math.floor(_denTimerSecs/60)).padStart(2,'0');
            const s = String(_denTimerSecs%60).padStart(2,'0');
            document.getElementById('den-timer').textContent = `🔴 ${m}:${s}`;
        }, 1000);
    } catch(e) { mostrarToast('❌ No se pudo acceder al micrófono', 'fa-microphone-slash'); }
}

function detenerGrabacion() {
    if (_denMediaRec && _denMediaRec.state !== 'inactive') _denMediaRec.stop();
    _denGrabando = false;
    if (_denTimerIntvl) { clearInterval(_denTimerIntvl); _denTimerIntvl = null; }
    document.getElementById('btn-grabar-den').style.display  = 'flex';
    document.getElementById('btn-detener-den').style.display = 'none';
    document.getElementById('den-timer').style.display       = 'none';
}

async function enviarDenuncia() {
    const nombre      = document.getElementById('denuncia-nombre').value.trim();
    const cargo       = document.getElementById('denuncia-cargo').value;
    const ciclo       = document.getElementById('denuncia-ciclo').value;
    const especialidad = document.getElementById('denuncia-especialidad')?.value || '';
    const descripcion = document.getElementById('denuncia-descripcion').value.trim();
    const fecha       = document.getElementById('denuncia-fecha').value;
    const hora        = document.getElementById('denuncia-hora').value;
    const btn         = document.getElementById('btn-enviar-denuncia');
    if (!nombre || !cargo || !descripcion) { mostrarToast('⚠️ Completa los campos obligatorios', 'fa-exclamation-circle'); return; }
    if (descripcion.length < 20) { mostrarToast('⚠️ La descripción es muy corta (mín. 20 caracteres)', 'fa-exclamation-circle'); return; }
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…';
    try {
        let evidenciaUrl = '', evidenciaTipo = '';
        const archivoASubir = _denEvidFile || (_denAudioBlob ? new File([_denAudioBlob], 'audio_denuncia.webm', { type:'audio/webm' }) : null);
        if (archivoASubir) {
            evidenciaTipo = _denEvidFile
                ? (_denEvidFile.type.startsWith('image/') ? 'foto' : _denEvidFile.type.startsWith('video/') ? 'video' : 'audio')
                : 'audio';
            const resourceType = evidenciaTipo === 'foto' ? 'image' : evidenciaTipo === 'video' ? 'video' : 'raw';
            const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/${resourceType}/upload`;
            const fd = new FormData();
            fd.append('file', archivoASubir); fd.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET); fd.append('folder', 'denuncias_clouddesk');
            const res = await fetch(endpoint, { method:'POST', body:fd });
            if (res.ok) { const data = await res.json(); evidenciaUrl = data.secure_url; }
        }
        const idAnonimo = 'DEN-' + Math.random().toString(36).substring(2,8).toUpperCase();
        await database.ref('denuncias').push({
            denunciado_nombre: nombre,
            denunciado_cargo: cargo === 'Estudiante'
                ? `${cargo}${especialidad ? ' · ' + especialidad : ''}${ciclo ? ' · Ciclo ' + ciclo : ''}`
                : cargo,
            descripcion, evidencia_url: evidenciaUrl, evidencia_tipo: evidenciaTipo,
            fecha, hora, timestamp: Date.now(), estado: 'pendiente', id_anonimo: idAnonimo
        });
        _mostrarDenStep(3);
      
    } catch(e) {
        console.error('Error enviando denuncia:', e);
        mostrarToast('❌ Error al enviar la denuncia. Intenta de nuevo.', 'fa-times-circle');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Denuncia';
    }
}

// ============================================
// PASO "SABER MÁS" — CUENTA NO REGISTRADA
// ============================================

/**
 * Muestra el paso explicativo cuando la cuenta no está registrada.
 * Oculta todo lo anterior y muestra el diseño con imagen + caja de scroll.
 */
async function mostrarSaberMas() {
    _ocultarTodosLosSteps();

    const step = document.getElementById('auth-step-no-registrado');
    if (step) step.style.display = 'block';

    // Carga las especialidades activas desde Firebase
    await cargarEspecialidadesActivas();
}

/**
 * Consulta Firebase y muestra solo las especialidades/ciclos
 * que tienen al menos un usuario registrado.
 */
async function cargarEspecialidadesActivas() {
    const container = document.getElementById('no-reg-especialidades');
    if (!container) return;

    try {
        const snap    = await database.ref('codigos').once('value');
        const codigos = snap.val() || {};

        // Agrupa por especialidad → conjunto de ciclos
        // especMap = { "Comunicación": Set(["V", "VII"]), "Inicial": Set(["III"]) }
        const especMap = {};

        for (const [key, data] of Object.entries(codigos)) {
            // Solo cuenta si tiene especialidad asignada
            if (data.especialidad && data.especialidad.trim() !== '') {
                const esp = data.especialidad.trim();
                if (!especMap[esp]) {
                    especMap[esp] = new Set();
                }
                if (data.ciclo && data.ciclo.trim() !== '') {
                    especMap[esp].add(data.ciclo.trim());
                }
            }
        }

        // Si no hay ninguna especialidad, muestra mensaje
        if (Object.keys(especMap).length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;padding:0.3rem 0;">No hay especialidades disponibles actualmente.</p>';
            return;
        }

        // Construye las tarjetas de cada especialidad
        container.innerHTML = '';
        for (const [esp, ciclosSet] of Object.entries(especMap)) {
            // Ordena los ciclos alfabéticamente
            const ciclos = Array.from(ciclosSet).sort();

            const div       = document.createElement('div');
            div.className   = 'no-reg-esp-item';

            const ciclosBadges = ciclos
                .map(c => `<span class="no-reg-ciclo-badge">Ciclo ${c}</span>`)
                .join('');

            div.innerHTML = `
                <div class="no-reg-esp-nombre">
                    <i class="fa-solid fa-book-open"></i> ${esp}
                </div>
                <div class="no-reg-ciclos">
                    ${ciclosBadges || '<span style="color:var(--text-muted);font-size:0.72rem;">Sin ciclos especificados</span>'}
                </div>
            `;
            container.appendChild(div);
        }

    } catch (e) {
        console.error('Error cargando especialidades activas:', e);
        container.innerHTML = '<p style="color:var(--danger);font-size:0.78rem;">Error al cargar las especialidades.</p>';
    }
}

function volverAlLogin() {
    _ocultarTodosLosSteps();
    mostrarPaso1();
}

// ============================================
// FOTO AMPLIADA DE ESTUDIANTE
// ============================================
function abrirFotoEstudiante(fotoUrl, nombre) {
    const modal = document.getElementById('fotoEstudianteModal');
    const img   = document.getElementById('fotoEstudianteImg');
    if (!modal || !img) return;
    img.alt = nombre || '';
    img.onerror = function() {
        this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nombre || '?') + '&background=3b82f6&color=fff&size=200';
    };
    img.src = fotoUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(nombre || '?') + '&background=3b82f6&color=fff&size=200');
    modal.style.display = 'flex';
}

// ============================================
// MENÚ FOTO MI PERFIL (LÁPIZ EN MI CARD)
// ============================================
function toggleMenuFotoMiCard() {
    const menu = document.getElementById('mi-card-menu-foto');
    if (!menu) return;
    const estaAbierto = menu.style.display === 'block';
    menu.style.display = estaAbierto ? 'none' : 'block';
    if (!estaAbierto) {
        setTimeout(() => {
            document.addEventListener('click', _cerrarMenuFotoFuera, { once: true });
        }, 10);
    }
}

function cerrarMenuFotoMiCard() {
    const menu = document.getElementById('mi-card-menu-foto');
    if (menu) menu.style.display = 'none';
}

function _cerrarMenuFotoFuera(e) {
    const wrap = document.querySelector('.mi-card-foto-wrap');
    if (wrap && !wrap.contains(e.target)) cerrarMenuFotoMiCard();
}

function verFotoMiPerfil() {
    cerrarMenuFotoMiCard();
    const perfil = getMiPerfil();
    if (!perfil) return;
    if (!perfil.foto_url) {
        mostrarToast('⚠️ Aún no tienes foto de perfil', 'fa-exclamation-circle');
        return;
    }
    abrirFotoEstudiante(perfil.foto_url, perfil.nombre || '');
}

async function eliminarFotoMiPerfil() {
    cerrarMenuFotoMiCard();
    const perfil = getMiPerfil();
    if (!perfil) return;
    if (!perfil.foto_url) {
        mostrarToast('⚠️ No tienes foto de perfil', 'fa-exclamation-circle');
        return;
    }
    const confirmar = confirm('¿Seguro que quieres eliminar tu foto de perfil?');
    if (!confirmar) return;

    const authData  = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');
    const urlActual = perfil.foto_url;

    mostrarSkeletonFoto();

    perfil.foto_url = '';
    localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));

    actualizarPerfilSidebar();

    await eliminarImagenCloudinary(urlActual).catch(e => console.error('Cloudinary error:', e));

    if (authData.codigo) {
        database.ref(`codigos/${authData.codigo}/perfil/foto_url`)
            .set('').catch(console.error);
    }

    if (supabaseClient && perfil.supabase_registered) {
        supabaseClient
            .from('estudiantes')
            .update({ foto_url: '' })
            .eq('nombre_completo', perfil.nombre)
            .then(({ error }) => {
                if (error) console.error('Supabase error al borrar foto:', error);
                else cargarEstudiantes();
            })
            .catch(console.error);
    }

    // ocultarSkeletonFoto() ← ELIMINAR esta línea que estaba aquí
    actualizarEncabezadoEstudiantes();
    ocultarSkeletonFoto();
    mostrarToast('✅ Foto eliminada con éxito', 'fa-check-circle');
}

function cerrarFotoEstudiante() {
    const modal = document.getElementById('fotoEstudianteModal');
    if (modal) modal.style.display = 'none';
}

function mostrarSkeletonFoto() {
    const wrap = document.querySelector('.mi-card-foto-wrap');
    if (wrap) wrap.classList.add('foto-cargando');
}

function ocultarSkeletonFoto() {
    const wrap = document.querySelector('.mi-card-foto-wrap');
    if (wrap) wrap.classList.remove('foto-cargando');
}

function previewFotoRegistro(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { mostrarToast('⚠️ Imagen muy grande. Máx 5MB.', 'fa-exclamation-circle'); return; }
    if (!file.type.startsWith('image/')) { mostrarToast('⚠️ Selecciona una imagen válida.', 'fa-exclamation-circle'); return; }
    registroFotoFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img         = document.getElementById('fotoConfirmacion');
        const uploadArea  = document.getElementById('reg-foto-upload-area');
        const cambiarBtn  = document.getElementById('reg-foto-cambiar-btn');
        const errEl       = document.getElementById('reg-foto-error');
        if (img)         { img.src = e.target.result; img.style.display = 'block'; }
        if (uploadArea)  uploadArea.style.display  = 'none';
        if (cambiarBtn)  cambiarBtn.style.display  = 'flex';
        if (errEl)       errEl.style.display       = 'none';
    };
    reader.readAsDataURL(file);
}

// ============================================
// DETECTOR DE CONEXIÓN A INTERNET
// ============================================

const loaderText = document.querySelector('.connection-loader-content p');
let _sinConexionTimeout = null;

// Congela la animación del loader
function freezeLoader() {
    if (_loaderAnimFrame) {
        cancelAnimationFrame(_loaderAnimFrame);
        _loaderAnimFrame = null;
    }
    const dm = document.getElementById('displacement-map');
    if (dm) dm.setAttribute('scale', '0');
}

// Reactiva la animación del loader
function unfreezeLoader() {
    const dm = document.getElementById('displacement-map');
    if (!dm) return;
    let t = 0;
    function loop() {
        t += 0.10;
        dm.setAttribute('scale', 15 + Math.sin(t * 2) * 1.5);
        _loaderAnimFrame = requestAnimationFrame(loop);
    }
    loop();
}

window.addEventListener('offline', () => {
    // Limpiar timeout previo si existe
    if (_sinConexionTimeout) {
        clearTimeout(_sinConexionTimeout);
        _sinConexionTimeout = null;
    }

    // Paso 1: mostrar loader CONGELADO con "Has perdido conexión"
    showConnectionLoader();
    freezeLoader();
    loaderText.textContent = 'Has perdido conexión';

    // Paso 2: después de 2 segundos → "Intentando reconectar..." con animación
    setTimeout(() => {
        if (!navigator.onLine) {
            loaderText.textContent = 'Intentando reconectar...';
            unfreezeLoader();

            // Paso 3: si después de 15 segundos sigue sin internet
            _sinConexionTimeout = setTimeout(() => {
                if (!navigator.onLine) {
                    loaderText.textContent = 'Sin conexión a internet';
                    freezeLoader();
                }
            }, 5000);
        }
    }, 2000);
});

window.addEventListener('online', () => {
    // Limpiar timeout si estaba corriendo
    if (_sinConexionTimeout) {
        clearTimeout(_sinConexionTimeout);
        _sinConexionTimeout = null;
    }

    // "Conectando..." con animación y ocultar después de 2 segundos
    loaderText.textContent = 'Conectando...';
    unfreezeLoader();
    setTimeout(() => {
        hideConnectionLoader();
        loaderText.textContent = 'Conectando...';
    }, 2000);
});

/* ══════════════════════════════════════════
   AJUSTES
══════════════════════════════════════════ */
function abrirModalAjustes() {
    const modal = document.getElementById('modal-ajustes');
    if (!modal) return;
    // Resetear estado de Seguridad al abrir
    const opciones = document.getElementById('ajustes-opciones');
    const chevron  = document.getElementById('ajustes-chevron');
    if (opciones) opciones.style.display = 'none';
    if (chevron)  chevron.classList.remove('open');
    modal.style.display = 'flex';
}

function cerrarModalAjustes() {
    const modal = document.getElementById('modal-ajustes');
    if (modal) modal.style.display = 'none';
}

function toggleSeguridad() {
    const opciones = document.getElementById('ajustes-opciones');
    const chevron  = document.getElementById('ajustes-chevron');
    if (!opciones) return;
    const abierto = opciones.style.display !== 'none';
    opciones.style.display = abierto ? 'none' : 'block';
    if (chevron) chevron.classList.toggle('open', !abierto);
}

function abrirVincularEscritorio() {
    const modal = document.getElementById('modal-vincular-escritorio');
    if (!modal) return;
    const api   = localStorage.getItem('eduspace_api') || '';
    const input = document.getElementById('vincular-api-input');
    if (input) { input.value = api; input.type = 'password'; }
    const iconEye = document.getElementById('icon-ver-api');
    if (iconEye) iconEye.className = 'fa-solid fa-eye';
    const btnCopiar = document.getElementById('btn-copiar-api');
    if (btnCopiar) {
        btnCopiar.classList.remove('copiado');
        btnCopiar.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar Clave';
    }
    modal.style.display = 'flex';
}

function cerrarVincularEscritorio() {
    const modal = document.getElementById('modal-vincular-escritorio');
    if (modal) modal.style.display = 'none';
}

function toggleVerAPI() {
    const input   = document.getElementById('vincular-api-input');
    const iconEye = document.getElementById('icon-ver-api');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (iconEye) iconEye.className = 'fa-solid fa-eye-slash';
    } else {
        input.type = 'password';
        if (iconEye) iconEye.className = 'fa-solid fa-eye';
    }
}

function copiarClaveAPI() {
    const input = document.getElementById('vincular-api-input');
    const btn   = document.getElementById('btn-copiar-api');
    if (!input || !input.value) return;
    const aplicarCopiado = () => {
        if (btn) {
            btn.classList.add('copiado');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
            setTimeout(() => {
                btn.classList.remove('copiado');
                btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar Clave';
            }, 2500);
        }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(aplicarCopiado).catch(() => {
            input.type = 'text'; input.select(); document.execCommand('copy'); aplicarCopiado();
        });
    } else {
        input.type = 'text'; input.select(); document.execCommand('copy'); aplicarCopiado();
    }
}

async function cerrarSesion() {
    const confirmado = confirm('¿Seguro que deseas cerrar sesión en este dispositivo?');
    if (!confirmado) return;
    try {
        const authRaw  = localStorage.getItem('eduspace_auth');
        const authData = authRaw ? JSON.parse(authRaw) : null;
        if (authData && authData.codigo && authData.googleUid && authData.deviceType) {
            const deviceKey = `${authData.googleUid}_${authData.deviceType}`;
            await database.ref(`codigos/${authData.codigo}/dispositivos/${deviceKey}`).remove();
        }
    } catch (e) { console.error('Error al limpiar dispositivo:', e); }
    localStorage.removeItem('eduspace_auth');
    localStorage.removeItem('eduspace_student_profile');
    localStorage.removeItem('eduspace_api');
    localStorage.removeItem('eduspace_instance_id');
    localStorage.removeItem('completedAssignments');
    try { await auth.signOut(); } catch (e) { console.error(e); }
    location.reload();
}
