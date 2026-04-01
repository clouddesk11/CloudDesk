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
        'auth-step-code', 'auth-step-google',
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
            actualizarPerfilSidebar();
            verificarBienvenida();   // ← línea nueva
            return;
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
        // DESPUÉS
        iniciarListenerBloqueo(); iniciarListenerSupabaseRegistered(); iniciarListenerFotoPerfil();
        actualizarPerfilSidebar();
        verificarBienvenida();   // ← línea nueva
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
            verificarBienvenida();   // ← línea nueva
            return;
        }

        if (apiNum && getDeviceType() === 'mobile') localStorage.setItem('eduspace_api', String(apiNum));
        _setTempValidacion(null);
        hideAuthModal();
        if (codigo === '6578hy') showSpecialUserMessage();
        iniciarListenerBloqueo();
        iniciarListenerSupabaseRegistered();
        iniciarListenerFotoPerfil();
        actualizarPerfilSidebar();

    } catch (error) {
        console.error('Error en procesarLoginGoogle:', error);
        if (errEl) { errEl.textContent = '❌ Error de conexión. Intenta nuevamente.'; errEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
    }
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

// ============================================
// LISTENER FOTO PERFIL EN TIEMPO REAL
// ============================================
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
            actualizarSeccionPerfil();
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
// RECURSOS DB
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
    const lista = recursosDB[currentRecursosTipo] || [];
    const filtrados = lista
        .map(r => ({ ...r, relevance: calculateRelevance(r, searchTerms, ['title','description']) }))
        .filter(r => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);
    recursosContainer.innerHTML = '';
    if (filtrados.length === 0) {
        recursosContainer.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No se encontraron resultados.</p>`;
        return;
    }
    filtrados.forEach(r => {
        if (r.type === 'Video')        renderVideoCard(r);
        else if (r.type === 'Imagen')  renderImageCard(r);
        else                           renderDocumentCard(r);
    });
}

// ============================================
// RECURSOS — VERSIÓN SIMPLIFICADA
// ============================================

let currentRecursosTipo = 'Documentos';

function filterRecursosTipo(tipo) {
    currentRecursosTipo = tipo;
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
        recursosContainer.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem;">No hay ${currentRecursosTipo} disponibles aún.</p>`;
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
                <button onclick="viewFile('${recurso.urlView}')" class="btn btn-view">
                    <i class="fa-regular fa-eye"></i> Ver
                </button>
                <a href="${recurso.urlDownload}" download class="btn btn-download">
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
// LIBROS — FUNCIONES COMPLETAS
// ============================================

let currentLibrosCategoria = 'Todo';

function filterLibros(categoria) {
    currentLibrosCategoria = categoria;
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
    grid.innerHTML = `<div class="libros-loading"><i class="fa-solid fa-spinner fa-spin"></i><p>Cargando libros...</p></div>`;
    if (_librosRealtimeRef) { _librosRealtimeRef.off('value'); _librosRealtimeRef = null; }
    _librosRealtimeRef = database.ref('libros');
    _librosRealtimeRef.on('value', (snap) => {
        const val = snap.val();
        let lista = [];
        if (val) {
            lista = Object.entries(val)
                .map(([key, data]) => ({ _key: key, ...data }))
                .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        }
        if (currentLibrosCategoria !== 'Todo') {
            lista = lista.filter(l => l.categoria === currentLibrosCategoria);
        }
        renderLibros(lista);
    }, (error) => {
        console.error('Error cargando libros:', error);
        grid.innerHTML = `<div class="libros-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Error al cargar los libros.</p></div>`;
    });
}

function renderLibros(libros) {
    const grid = document.getElementById('libros-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!libros || libros.length === 0) {
        grid.innerHTML = `<div class="libros-empty"><i class="fa-solid fa-book-open"></i><p>No hay libros en esta categoría aún.</p></div>`;
        return;
    }
    libros.forEach((libro, idx) => {
        const card = document.createElement('div');
        card.className = 'libro-card';
        card.style.animation      = 'fadeIn 0.4s ease';
        card.style.animationDelay = `${idx * 0.06}s`;
        card.innerHTML = `
            <div class="libro-card-portada">
                ${libro.portada_url
                    ? `<img src="${libro.portada_url}" alt="${libro.titulo}"
                            onerror="this.style.display='none';this.parentElement.querySelector('.libro-card-portada-fallback').style.display='flex'">
                       <i class="fa-solid fa-book libro-card-portada-fallback" style="display:none;font-size:3.5rem;color:rgba(255,255,255,.6);"></i>`
                    : `<i class="fa-solid fa-book libro-card-portada-fallback"></i>`}
                <span class="libro-card-categoria-badge">${libro.categoria || 'Sin categoría'}</span>
            </div>
            <div class="libro-card-body">
                <h3 class="libro-card-titulo">${libro.titulo || 'Sin título'}</h3>
                <p class="libro-card-descripcion">${libro.descripcion || 'Sin descripción disponible.'}</p>
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
                    <a href="${libro.archivo_url || '#'}" target="_blank" rel="noopener noreferrer"
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
        img.src = portadaUrl; img.style.display = 'block';
        img.onerror = function() { this.style.display = 'none'; };
    } else { img.style.display = 'none'; }
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

function mostrarToast(mensaje, icono = 'fa-check-circle', duracion = 3000) {
    const toast = document.createElement('div'); toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fa-solid ${icono}"></i><span>${mensaje}</span>`;
    document.body.appendChild(toast); setTimeout(() => toast.remove(), duracion);
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
            <p>Los estudiantes aparecerán aquí una vez sean registrados.</p>
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

        card.addEventListener('click', function(e) {
            if (e.target.closest('.btn-solicitud')) return;
            abrirFotoEstudiante(this.dataset.otroFoto, this.dataset.otroNom);
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
// CAMBIO: se agregó el botón "Amigos"
// ============================================
function actualizarEncabezadoEstudiantes() {
    const perfil        = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const headerMiembro = document.getElementById('estudiantes-header-miembro');
    const miCardEl      = document.getElementById('mi-card-estudiante');

    if (!perfil || !perfil.supabase_registered) {
        if (headerMiembro) headerMiembro.style.display = 'none';
        return;
    }

    if (headerMiembro) headerMiembro.style.display = 'block';

    if (miCardEl) {
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre || '?')}&background=3b82f6&color=fff&size=200`;
        miCardEl.innerHTML = `
            <div class="perfil-mini-header-row">
                <div class="perfil-mini-foto-wrap"
                     onclick="switchTab('perfil')"
                     title="Ver mi perfil">
                    <img src="${perfil.foto_url || fallback}"
                         alt="${perfil.nombre || ''}"
                         class="perfil-mini-foto"
                         onerror="this.src='${fallback}'">
                </div>
                <button class="btn-solicitudes" id="btn-solicitudes" onclick="abrirSolicitudes()">
                    <i class="fa-solid fa-user-clock"></i> Solicitudes
                </button>
                <button class="btn-chat-comunidad" id="btn-chat-comunidad" onclick="abrirChatDesdeComunidad()">
                    <i class="fa-solid fa-comment"></i> Chat
                </button>
                <button class="btn-amigos" onclick="abrirAmigos()">
                    <i class="fa-solid fa-user-friends"></i> Amigos
                </button>
            </div>
        `;
        iniciarListenerSolicitudes();
    }
}

// ============================================
// SECCIÓN PERFIL — CONTENIDO DINÁMICO
// CAMBIO: reemplazado btn-amigos por facepile
// ============================================
function actualizarSeccionPerfil() {
    const perfil    = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const contenido = document.getElementById('perfil-seccion-contenido');
    if (!contenido) return;

    if (!perfil || !perfil.supabase_registered) {
        contenido.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fa-solid fa-user-slash" style="font-size:3rem;margin-bottom:1rem;opacity:.5;display:block;"></i>
                <p>Únete a la comunidad para ver tu perfil.</p>
            </div>`;
        return;
    }

    const fecha      = perfil.fecha_registro || '—';
    const tieneFoto  = !!(perfil.foto_url && perfil.foto_url.trim() !== '');
    const fallback   = `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre || '?')}&background=3b82f6&color=fff&size=200`;

    contenido.innerHTML = `
        <div class="perfil-seccion-inner">
            <div class="mi-card-wrapper">
                <div class="mi-card-foto-wrap">
                    <img src="${perfil.foto_url || fallback}"
                         alt="${perfil.nombre || ''}"
                         class="mi-card-foto"
                         onerror="this.src='${fallback}'">
                    <button class="mi-card-lapiz" title="Opciones de foto"
                            onclick="event.stopPropagation(); toggleMenuFotoMiCard()">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <div class="mi-card-menu-foto" id="mi-card-menu-foto" style="display:none;">
                        ${tieneFoto ? `
                        <button onclick="verFotoMiPerfil()">
                            <i class="fa-solid fa-eye"></i> Ver foto
                        </button>
                        <hr>` : ''}
                        <button onclick="document.getElementById('mi-card-foto-input').click(); cerrarMenuFotoMiCard()">
                            <i class="fa-solid fa-camera"></i> ${tieneFoto ? 'Cambiar foto' : 'Subir foto'}
                        </button>
                        ${tieneFoto ? `
                        <hr>
                        <button class="btn-eliminar-foto" onclick="eliminarFotoMiPerfil()">
                            <i class="fa-solid fa-trash"></i> Eliminar foto
                        </button>` : ''}
                    </div>
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
            <div class="perfil-amigos-seccion">
                <p class="perfil-amigos-label">
                    <i class="fa-solid fa-user-friends"></i> Amigos
                </p>
                <div class="facepile-row" id="facepile-amigos">
                    <span style="color:var(--text-muted);font-size:0.8rem;">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                    </span>
                </div>
                <p class="perfil-institucion">
                    <i class="fa-solid fa-school"></i> I.E.S.P.P. Picota - San Martín
                </p>
            </div>
        </div>
    `;
    renderFacepileAmigos();
}

// ============================================
// FACEPILE DE AMIGOS — SECCIÓN MI PERFIL
// NUEVO: función que construye los círculos
// ============================================
async function renderFacepileAmigos() {
    const miKey     = getMiKey();
    const container = document.getElementById('facepile-amigos');
    if (!container || !miKey) return;

    // Cuántos círculos de foto mostrar según el dispositivo
    const esMobile = window.innerWidth <= 768;
    const maxVer   = esMobile ? 3 : 7;

    try {
        const snap   = await database.ref('amigos/' + miKey).once('value');
        const amigos = snap.val();

        // Si no tiene amigos aún
        if (!amigos || !Object.keys(amigos).length) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem;">Aún no tienes amigos.</span>';
            return;
        }

        const lista     = Object.entries(amigos); // [[key, {nombre, foto}], ...]
        const total     = lista.length;
        const aMostrar  = lista.slice(0, maxVer);  // solo los primeros N
        const restantes = total - maxVer;           // los que NO se muestran en pantalla

        container.innerHTML = '';

        // Al hacer clic en cualquier círculo → ir a Comunidad y abrir panel de Amigos
        function irAAmigos() {
            switchTab('estudiantes');
            setTimeout(function() { abrirAmigos(); }, 350);
        }

        // Crear un círculo con foto por cada amigo a mostrar
        aMostrar.forEach(function(entrada) {
            const amigoData = entrada[1];
            const fallback  = 'https://ui-avatars.com/api/?name=' +
                              encodeURIComponent(amigoData.nombre || '?') +
                              '&background=3b82f6&color=fff&size=200';

            const item      = document.createElement('div');
            item.className  = 'facepile-item';
            item.title      = amigoData.nombre || ''; // tooltip con nombre al pasar el cursor
            item.onclick    = irAAmigos;
            item.innerHTML  = '<img src="' + (amigoData.foto || fallback) + '" ' +
                              'alt="' + (amigoData.nombre || '') + '" ' +
                              'onerror="this.src=\'' + fallback + '\'">';
            container.appendChild(item);
        });

        // Último círculo: "+N" si quedan amigos fuera del límite, o ícono de grupo si caben todos
        const textoContador = restantes > 0
            ? '+' + restantes
            : '<i class="fa-solid fa-users"></i>';

        const verTodosItem      = document.createElement('div');
        verTodosItem.className  = 'facepile-item';
        verTodosItem.onclick    = irAAmigos;
        verTodosItem.innerHTML  =
            '<div class="facepile-ver-todos-circulo">' + textoContador + '</div>' +
            '<span class="facepile-ver-todos-label">Ver todos</span>';
        container.appendChild(verTodosItem);

    } catch(e) {
        console.error('Error en renderFacepileAmigos:', e);
        container.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">Error al cargar.</span>';
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

    const ajustesWrapper = document.getElementById('sidebar-ajustes-wrapper');
    if (ajustesWrapper) {
        ajustesWrapper.style.display = 'block';
        const btnVincular = document.getElementById('btn-vincular-escritorio');
        if (btnVincular) {
            btnVincular.style.display = getDeviceType() === 'mobile' ? 'flex' : 'none';
        }
    }
}

// ============================================
// ABRIR PERFIL ESTUDIANTE
// ============================================
function abrirPerfilEstudiante() {
    switchTab('perfil');
}

function cerrarPerfilEstudiante() {
    // modal eliminado, ya no se usa
}

function cambiarFotoSidebar() {
    // sidebar-foto-file-input ya no existe, la foto se cambia desde sección perfil
}

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

// ============================================
// FOOTER MÓVIL — BOTÓN ACTIVO
// NUEVO: resalta el botón del tab activo
// ============================================
function actualizarFooterActivo(tab) {
    // Mapa: nombre del tab → id del botón en el footer
    const mapa = {
        'repositorio': 'footer-btn-repositorio',
        'trabajos':    'footer-btn-trabajos',
        'estudiantes': 'footer-btn-comunidad',
        'chat':        'footer-btn-comunidad',
        'perfil':      'footer-btn-perfil'
    };
    // Quitar la clase activa de TODOS los botones del footer
    document.querySelectorAll('.mobile-footer-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    // Poner la clase activa SOLO al botón que corresponde al tab actual
    const idBtn = mapa[tab];
    if (idBtn) {
        const btn = document.getElementById(idBtn);
        if (btn) btn.classList.add('active');
    }
}

// ============================================
// SWITCH TAB
// CAMBIO: se llama a actualizarFooterActivo
// ============================================
function switchTab(tab) {
    currentTab = tab; showingFinalizados = false;
    if (window.innerWidth <= 768) closeSidebar();
    actualizarFooterActivo(tab);

    // Ocultar todas las secciones
    sectionRepositorio.style.display = 'none';
    sectionTrabajos.style.display    = 'none';
    sectionRecursos.style.display    = 'none';
    if (sectionLibros)  sectionLibros.style.display  = 'none';
    sectionDocentes.style.display    = 'none';
    sectionEstudiantes.style.display = 'none';
    if (sectionChat) sectionChat.style.display = 'none';
    const sectionPerfil = document.getElementById('perfil');
    if (sectionPerfil) sectionPerfil.style.display = 'none';
    const sectionIa = document.getElementById('ia-juegos');
    if (sectionIa) sectionIa.style.display = 'none';
   const sectionGp = document.getElementById('gramatica-pro-app');
if (sectionGp) sectionGp.style.display = 'none';
const sectionCcq = document.getElementById('cuacua-app');   
if (sectionCcq) sectionCcq.style.display = 'none';           
    
  document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.ai-btn')?.classList.remove('active');
document.querySelector('.ai-btn-mobile')?.classList.remove('active');

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
        currentRecursosTipo = 'Documentos';
        document.querySelectorAll('.recursos-tipo-btn').forEach(b => b.classList.remove('active'));
        const rtbtn = document.getElementById('rtbtn-Documentos');
        if (rtbtn) rtbtn.classList.add('active');
        renderRecursosContent();

    } else if (tab === 'libros') {
        if (sectionLibros) sectionLibros.style.display = 'block';
        const tabLibros = document.getElementById('tab-libros');
        if (tabLibros) tabLibros.classList.add('active');
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

    } else if (tab === 'perfil') {
    if (sectionPerfil) sectionPerfil.style.display = 'block';
    actualizarSeccionPerfil();

} else if (tab === 'ia-juegos') {
        const sectionIa = document.getElementById('ia-juegos');
        if (sectionIa) sectionIa.style.display = 'block';
        document.querySelector('.ai-btn')?.classList.add('active');
        document.querySelector('.ai-btn-mobile')?.classList.add('active');

    } else if (tab === 'gramatica-pro-app') {   
        const sectionGp = document.getElementById('gramatica-pro-app');
        if (sectionGp) sectionGp.style.display = 'block';
        document.querySelector('.ai-btn')?.classList.add('active');      
        document.querySelector('.ai-btn-mobile')?.classList.add('active'); 
    } else if (tab === 'cuacua-app') {                                      
        const sectionCcq = document.getElementById('cuacua-app');
        if (sectionCcq) sectionCcq.style.display = 'block';
        document.querySelector('.ai-btn')?.classList.add('active');
        document.querySelector('.ai-btn-mobile')?.classList.add('active');
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

function renderMensaje(msg, miKey) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl || !msg) return;
    const esMio = msg.de_key === miKey;
    const hora = msg.fecha
        ? new Date(msg.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : '';
    const wrap = document.createElement('div');
    wrap.className = `chat-bubble-wrapper ${esMio ? 'mio' : 'otro'}`;
    wrap.innerHTML = `
        <div class="chat-bubble ${esMio ? 'mio' : 'otro'}">
            ${msg.texto}
            <div class="chat-bubble-time">${hora}</div>
        </div>`;
    messagesEl.appendChild(wrap);
}

async function abrirChatConAmigo(chatId, otroKey, otroNombre, otroFoto) {
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

    const isMobile  = window.innerWidth <= 768;
    const winHeader = document.getElementById('chat-win-header');
    if (winHeader) {
        winHeader.innerHTML = `
            ${isMobile ? `<button class="chat-back-btn" onclick="volverListaChats()"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
            <img src="${otroFoto}" alt="${otroNombre}" class="chat-header-foto"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(otroNombre)}&background=3b82f6&color=fff&size=200'">
            <span class="chat-header-nombre">${otroNombre}</span>`;
    }

    if (_mensajesListenerRef) {
        supabaseClient.removeChannel(_mensajesListenerRef);
        _mensajesListenerRef = null;
    }

    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) messagesEl.innerHTML = '';

    const miKey = getMiKey();

    const { data: mensajesAnteriores } = await supabaseClient
        .from('mensajes')
        .select('*')
        .eq('chat_id', chatId)
        .order('fecha', { ascending: true });

    if (mensajesAnteriores) {
        mensajesAnteriores.forEach(msg => renderMensaje(msg, miKey));
        if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    _mensajesListenerRef = supabaseClient
        .channel(`chat-${chatId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes',
            filter: `chat_id=eq.${chatId}`
        }, (payload) => {
            renderMensaje(payload.new, miKey);
            if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        })
        .subscribe();

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
    if (_mensajesListenerRef) {
        supabaseClient.removeChannel(_mensajesListenerRef);
        _mensajesListenerRef = null;
    }
    _chatActivoId = null; _chatActivoOtroKey = null;
}

async function enviarMensaje() {
    const input = document.getElementById('chat-input');
    const texto = input?.value?.trim();
    if (!texto || !_chatActivoId) return;
    const miPerfil = getMiPerfil();
    const miKey = getMiKey();
    if (!miPerfil || !miKey) return;
    input.value = '';
    try {
        const { error } = await supabaseClient
            .from('mensajes')
            .insert([{ chat_id: _chatActivoId, de_key: miKey, de_nombre: miPerfil.nombre, texto }]);
        if (error) throw error;
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
function abrirChatDesdeComunidad() { switchTab('chat'); }

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
// PASO "SABER MÁS" — CUENTA NO REGISTRADA
// ============================================
async function mostrarSaberMas() {
    _ocultarTodosLosSteps();
    const step = document.getElementById('auth-step-no-registrado');
    if (step) step.style.display = 'block';
    await cargarEspecialidadesActivas();
}

async function cargarEspecialidadesActivas() {
    const container = document.getElementById('no-reg-especialidades');
    if (!container) return;
    try {
        const snap    = await database.ref('codigos').once('value');
        const codigos = snap.val() || {};
        const especMap = {};
        for (const [key, data] of Object.entries(codigos)) {
            if (data.especialidad && data.especialidad.trim() !== '') {
                const esp = data.especialidad.trim();
                if (!especMap[esp]) especMap[esp] = new Set();
                if (data.ciclo && data.ciclo.trim() !== '') especMap[esp].add(data.ciclo.trim());
            }
        }
        if (Object.keys(especMap).length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;padding:0.3rem 0;">No hay especialidades disponibles actualmente.</p>';
            return;
        }
        container.innerHTML = '';
        for (const [esp, ciclosSet] of Object.entries(especMap)) {
            const ciclos = Array.from(ciclosSet).sort();
            const div = document.createElement('div');
            div.className = 'no-reg-esp-item';
            const ciclosBadges = ciclos.map(c => `<span class="no-reg-ciclo-badge">Ciclo ${c}</span>`).join('');
            div.innerHTML = `
                <div class="no-reg-esp-nombre">
                    <i class="fa-solid fa-book-open"></i> ${esp}
                </div>
                <div class="no-reg-ciclos">
                    ${ciclosBadges || '<span style="color:var(--text-muted);font-size:0.72rem;">Sin ciclos especificados</span>'}
                </div>`;
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

function cerrarFotoEstudiante() {
    const modal = document.getElementById('fotoEstudianteModal');
    if (modal) modal.style.display = 'none';
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

    actualizarEncabezadoEstudiantes();
    actualizarSeccionPerfil();
    ocultarSkeletonFoto();
    mostrarToast('✅ Foto eliminada con éxito', 'fa-check-circle');
}

// ============================================
// PROCESAR NUEVA FOTO DE PERFIL
// ============================================
async function procesarNuevaFotoPerfil(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('⚠️ La imagen es muy grande. Máximo 5MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('⚠️ Selecciona un archivo de imagen válido.'); return; }
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (!perfil) { alert('❌ No se encontró tu perfil.'); return; }

    mostrarSkeletonFoto();

    // Preview inmediato
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgMiCard  = document.querySelector('.mi-card-foto');
        const imgSidebar = document.getElementById('sidebar-profile-img');
        const initial    = document.getElementById('sidebar-profile-initial');
        if (imgMiCard)  imgMiCard.src = e.target.result;
        if (imgSidebar) { imgSidebar.src = e.target.result; imgSidebar.style.display = 'block'; }
        if (initial)    initial.style.display = 'none';
    };
    reader.readAsDataURL(file);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
        formData.append('folder', 'estudiantes_clouddesk');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
        if (!res.ok) throw new Error('Error al subir la imagen');
        const data = await res.json(); const nuevaUrl = data.secure_url;

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
        actualizarSeccionPerfil();
        ocultarSkeletonFoto();
        mostrarToast('✅ Foto actualizada correctamente');
    } catch(err) {
        ocultarSkeletonFoto();
        console.error(err); alert('❌ Error al actualizar la foto: ' + err.message);
    } finally {
        event.target.value = '';
    }
}

// ============================================
// SKELETON FOTO
// ============================================
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

function freezeLoader() {
    if (_loaderAnimFrame) { cancelAnimationFrame(_loaderAnimFrame); _loaderAnimFrame = null; }
    const dm = document.getElementById('displacement-map');
    if (dm) dm.setAttribute('scale', '0');
}

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
    if (_sinConexionTimeout) { clearTimeout(_sinConexionTimeout); _sinConexionTimeout = null; }
    showConnectionLoader();
    freezeLoader();
    loaderText.textContent = 'Has perdido conexión';
    setTimeout(() => {
        if (!navigator.onLine) {
            loaderText.textContent = 'Intentando reconectar...';
            unfreezeLoader();
            _sinConexionTimeout = setTimeout(() => {
                if (!navigator.onLine) { loaderText.textContent = 'Sin conexión a internet'; freezeLoader(); }
            }, 5000);
        }
    }, 2000);
});

window.addEventListener('online', () => {
    if (_sinConexionTimeout) { clearTimeout(_sinConexionTimeout); _sinConexionTimeout = null; }
    loaderText.textContent = 'Conectando...';
    unfreezeLoader();
    setTimeout(() => { hideConnectionLoader(); loaderText.textContent = 'Conectando...'; }, 2000);
});

/* ══════════════════════════════════════════
   AJUSTES
══════════════════════════════════════════ */
function abrirModalAjustes() {
    const modal = document.getElementById('modal-ajustes');
    if (!modal) return;
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

// ============================================
// BIENVENIDA — PRIMERA VEZ
// ============================================

const BIENVENIDA_VIDEO_URL = '';

const BIENVENIDA_STORAGE_KEY = 'clouddesk_bienvenida_v1';

function _bienvenida_esPrimeraVez() {
    return !localStorage.getItem(BIENVENIDA_STORAGE_KEY);
}

function _bienvenida_marcarVista() {
    localStorage.setItem(BIENVENIDA_STORAGE_KEY, '1');
}

function verificarBienvenida() {
     if (getDeviceType() !== 'mobile') return; 
    if (!_bienvenida_esPrimeraVez()) return;
    const perfil = getMiPerfil();
    const nombre = (perfil && perfil.nombre) ? perfil.nombre : 'Usuario';
    document.getElementById('bienvenida-nombre-span').textContent = nombre;
    _bienvenida_irStep(1);
    document.getElementById('modal-bienvenida').style.display = 'flex';
}

function _bienvenida_irStep(n) {
    [1, 2, 3].forEach(function(i) {
        var el = document.getElementById('bienvenida-s' + i);
        if (el) el.style.display = (i === n) ? 'block' : 'none';
    });
    
    var panel     = document.getElementById('bienvenida-panel');
    var videoWrap = document.getElementById('bienvenida-video-wrap');
    if (panel)     panel.style.display     = 'block';
    if (videoWrap) videoWrap.style.display = 'none';
}

function bienvenida_verMas() {
    _bienvenida_irStep(2);
}

function bienvenida_volverS1() {
    _bienvenida_irStep(1);
}

function bienvenida_continuar() {
    _bienvenida_irStep(3);
}

function bienvenida_abrirVideo() {
    var panel     = document.getElementById('bienvenida-panel');
    var videoWrap = document.getElementById('bienvenida-video-wrap');
    var iframe    = document.getElementById('bienvenida-video-iframe');
    if (panel)     panel.style.display     = 'none';
    if (videoWrap) videoWrap.style.display = 'block';
    if (iframe)    iframe.src              = BIENVENIDA_VIDEO_URL;
}

function bienvenida_cerrarTodo() {
    var modal  = document.getElementById('modal-bienvenida');
    var iframe = document.getElementById('bienvenida-video-iframe');
    if (iframe) iframe.src = ''; // detiene el video
    if (modal)  modal.style.display = 'none';
    _bienvenida_marcarVista();
}

let attemptedCards = [];
let _gpInicializado = false;

const SUPABASE_URL = 'https://dowoncayanvhrbrpvdms.supabase.co';
const SUPABASE_KEY =  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd29uY2F5YW52aHJicnB2ZG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMzQyMjYsImV4cCI6MjA4NjYxMDIyNn0.WyB7depGJfULdT8pi-rPf5ISASDX93Vh14nVlS-3x2s';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PROGRESO EN FIREBASE (no más localStorage) ──
async function gp_cargarProgreso() {
    try {
        const authRaw = localStorage.getItem('eduspace_auth');
        if (!authRaw) return;
        const { codigo } = JSON.parse(authRaw);
        const snap = await database.ref(`codigos/${codigo}/gramatica_progress/attemptedCards`).once('value');
        if (snap.val()) attemptedCards = snap.val();
    } catch(e) { console.error('Error cargando progreso gramática:', e); }
}
async function gp_guardarProgreso() {
    try {
        const authRaw = localStorage.getItem('eduspace_auth');
        if (!authRaw) return;
        const { codigo } = JSON.parse(authRaw);
        await database.ref(`codigos/${codigo}/gramatica_progress/attemptedCards`).set(attemptedCards);
    } catch(e) { console.error('Error guardando progreso gramática:', e); }
}
// DESPUÉS
function abrirGramaticaPro() {
    if (typeof switchTab === 'function') switchTab('gramatica-pro-app');
    // Fix bug: actualizar botón ANTES de que carguen los datos
    const gpBackBtn = document.querySelector('.gp-back-btn');
    if (gpBackBtn) {
        gpBackBtn.onclick = () => switchTab('ia-juegos');
        gpBackBtn.innerHTML = `<span class="gp-back-text-desktop"><i class="fa-solid fa-arrow-left"></i> Volver</span><span class="gp-back-text-mobile">&lt;</span>`;
    }
    initGramaticaPro();
}

function sparkle(size, gid, colorA, colorB) {
    colorA = colorA || '#B250FF';
    colorB = colorB || '#6550FF';
    return `<svg width="${size}" height="${size}" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="${gid}" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${colorA}"/><stop offset="100%" stop-color="${colorB}"/>
        </linearGradient></defs>
        <g fill="url(#${gid})" stroke="url(#${gid})" stroke-linejoin="round">
            <path stroke-width="8" d="M 75,40 Q 75,95 130,95 Q 75,95 75,150 Q 75,95 20,95 Q 75,95 75,40 Z"/>
            <path stroke-width="4" d="M 135,30 Q 135,50 155,50 Q 135,50 135,70 Q 135,50 115,50 Q 135,50 135,30 Z"/>
            <path stroke-width="6" d="M 150,100 Q 150,130 180,130 Q 150,130 150,160 Q 150,130 120,130 Q 150,130 150,100 Z"/>
        </g></svg>`;
}

document.getElementById('hdr-spark').innerHTML = sparkle(16,'hg','#ffffff','#c7d2fe');

let currentView  = 'menu';
let lastView     = '';
let activeTab    = null;       
let selectedItem = null;
let chatHistory  = [];
let sectionsData = [];         
let gameData = {
    questions:[], qIdx:0, score:0, streak:0, bestStreak:0,
    feedback:false, selected:null, aiExp:null, loading:false,
    evaluating:false, error:false
};


async function loadData() {
    
    const { data: secs } = await sb
        .from('sections')
        .select('*')
        .order('display_order');

    const { data: cds } = await sb
        .from('cards')
        .select('*')
        .order('display_order');

    if (!secs || !cds) return;

    sectionsData = secs.map(s => ({
        ...s,
        cards: cds.filter(c => c.section_id === s.id)
    }));

    if (!activeTab && sectionsData.length > 0) {
        activeTab = sectionsData[0].id;
    }
}

function setupRealtime() {
    sb.channel('cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, async () => {
            await loadData();
            if (currentView === 'menu') render();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, async () => {
            await loadData();
            if (currentView === 'menu' || currentView === 'detail') render();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, async () => {
        })
        .subscribe();
}

async function callGroq(prompt, system) {
    try {
        const r = await fetch('https://dowoncayanvhrbrpvdms.supabase.co/functions/v1/super-service', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ prompt, system })
        });
        const d = await r.json();
        return d.choices?.[0]?.message?.content || null;
    } catch(e) { return null; }
}

async function generateQuestions(mode) {
    gameData = {
        questions:[], qIdx:0, score:0, streak:0, bestStreak:0,
        feedback:false, userAnswer:null, aiExp:null,
        loading:true, evaluating:false, error:false
    };
    if (mode !== 'global' && !attemptedCards.includes(mode)) {
    attemptedCards.push(mode);
    gp_guardarProgreso();
}
    currentView = 'game';
    render();

    let rows, error;

    if (mode === 'global') {
        ({ data: rows, error } = await sb
            .from('global_questions')
            .select('*')
            .order('display_order'));

        if (error || !rows || rows.length === 0) {
            gameData.error = true; gameData.loading = false; render(); return;
        }

        const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, 5);
        gameData.questions = shuffled.map(q => ({
            type: 'global',
            itemRef: null,
            instruction: q.instruction || 'Identifica el elemento gramatical que se pide en la oración.',
            sentence: q.sentence,
            answers: [],
            logic: ''
        }));

    } else {
        ({ data: rows, error } = await sb
            .from('questions')
            .select('*, cards(*)')
            .eq('card_id', mode));

        if (error || !rows || rows.length === 0) {
            gameData.error = true; gameData.loading = false; render(); return;
        }

        const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, 3);
        gameData.questions = shuffled.map(q => ({
            type: mode,
            itemRef: q.cards,
            instruction: q.instruction || `¿Cuál es ${q.cards?.title?.toLowerCase()} en esta oración?`,
            sentence: q.sentence,
            answers: [],
            logic: ''
        }));
    }

    gameData.loading = false;
    render();
}

function startLevel(mode) { generateQuestions(mode); }

async function handleSubmit() {
    if (gameData.feedback || gameData.evaluating) return;
    const input = document.getElementById('game-input');
    if (!input) return;
    const userAnswer = input.value.trim();
    if (!userAnswer) { input.focus(); return; }

    gameData.userAnswer = userAnswer;
    gameData.evaluating = true;
    render();

    const q    = gameData.questions[gameData.qIdx];
    const item = q.itemRef;

    const sys = `Eres un evaluador experto y empático de gramática española.

ORACIÓN: "${q.sentence}"
PREGUNTA: "${q.instruction}"
${item ? `CONCEPTO: "${item.title}" — ${item.definition}\nPISTA: "${item.how_to_find}"` : ''}
RESPUESTA DEL ALUMNO: "${userAnswer}"

INSTRUCCIONES:
1. Analiza la oración y determina cuál es la respuesta correcta para lo que se pide.
2. Evalúa si el alumno respondió correctamente (ignora tildes, mayúsculas y frases de relleno).
3. Sé flexible: si el alumno demostró entender el concepto, considera CORRECTO.
4. En "answers" pon las respuestas correctas reales que encontraste en la oración.
5. Habla DIRECTAMENTE al alumno usando "tú".
   Si CORRECTO: felicítalo en 1 oración diciendo qué hizo bien.
   Si INCORRECTO: primero reconoce lo que sí acertó (si acertó algo), luego dile qué estuvo mal o qué faltó y por qué. Máximo 2 oraciones. 
   Ej: "Identificaste bien 'comiendo', pero te faltó incluir 'estaban' y 'conversaban', que también son verbos porque indican una acción."
   Si no acertó nada: dile directamente cuál era la respuesta y por qué, sin buscar algo positivo forzado.

Responde ÚNICAMENTE con JSON válido sin backticks:
{"correct":true,"answers":["respuesta1"],"explanation":"..."}`;

    const raw = await callGroq('Evalúa si el alumno respondió correctamente.', sys);
    let correct = false, explanation = '', correctAnswers = [];

    if (raw) {
        try {
            let clean = raw.trim().replace(/```json|```/g,'').trim();
            const match = clean.match(/\{[\s\S]*\}/);
            if (match) clean = match[0];
            const parsed = JSON.parse(clean);
            correct        = parsed.correct === true;
            explanation    = parsed.explanation || '';
            correctAnswers = Array.isArray(parsed.answers) ? parsed.answers : [];
        } catch(e) {
            correct = false;
            explanation = 'No se pudo evaluar. Inténtalo de nuevo.';
        }
    } else {
        correct = false;
        explanation = 'No se pudo conectar con la IA. Revisa tu conexión.';
    }

    gameData.feedback   = { correct, explanation, correctAnswers };
    gameData.evaluating = false;
    if (correct) {
        gameData.score++;
        gameData.streak++;
        if (gameData.streak > gameData.bestStreak) gameData.bestStreak = gameData.streak;
    } else {
        gameData.streak = 0;
    }
    render();
}

function handleGameEnter(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
}

async function getAiExplanation() {
    const btn = document.getElementById('btn-ai');
    if (btn) btn.innerHTML = `
        <span class="dot-bounce w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block"></span>
        <span class="dot-bounce w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block"></span>
        <span class="dot-bounce w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block"></span>
        <span class="ml-2 text-indigo-400 text-sm font-medium">Analizando...</span>`;

    const q    = gameData.questions[gameData.qIdx];
    const item = q.itemRef;

    const sys = item
        ? `Eres un profesor de gramática española amable y motivador. Explica errores en 2 oraciones máximo. Lenguaje sencillo. Concepto: ${item.title} — ${item.definition}. Pista clave: ${item.how_to_find}`
        : `Eres un profesor de gramática española amable y motivador. Explica brevemente el error en 2 oraciones máximo. Lenguaje sencillo.`;

    const correctStr = gameData.feedback.correctAnswers?.join(', ') || 'la respuesta correcta';
    const prompt = `El alumno respondió "${gameData.userAnswer}" pero la respuesta correcta era "${correctStr}" en la oración: "${q.sentence}". Explícale amablemente el error.`;

    const res = await callGroq(prompt, sys);
    gameData.aiExp = res || (item ? `Recuerda: ${item.how_to_find}` : 'Revisa bien la oración e intenta identificar el elemento pedido.');
    render();
}

function nextQ() {
    if (gameData.qIdx < gameData.questions.length - 1) {
        gameData.qIdx++;
        gameData.feedback   = false;
        gameData.userAnswer = null;
        gameData.aiExp      = null;
        gameData.evaluating = false;
        render();
        setTimeout(() => { const i = document.getElementById('game-input'); if(i) i.focus(); }, 80);
    } else {
        currentView = 'results';
        render();
    }
}

function generateChatHTML() {
    let html = `
        <div class="flex justify-start mb-3">
            <div class="flex-shrink-0 mr-2 mt-0.5">
                <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg">
                    <span class="text-white text-[10px] font-bold">AI</span>
                </div>
            </div>
            <div class="chat-bubble-ai bg-slate-800 border border-slate-700/50 px-3 py-2.5 text-xs text-slate-200 max-w-[85%] shadow-sm">
                ¡Hola! ¿Qué duda tienes sobre <strong>${selectedItem ? selectedItem.title : 'gramática'}</strong>? 😊
            </div>
        </div>`;
    chatHistory.forEach(m => {
        if (m.role === 'user') {
            html += `<div class="flex justify-end mb-3"><div class="chat-bubble-user bg-indigo-600 px-3 py-2.5 text-xs text-white max-w-[85%] shadow-md">${m.text}</div></div>`;
        } else {
            html += `
                <div class="flex justify-start mb-3">
                    <div class="flex-shrink-0 mr-2 mt-0.5"><div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center"><span class="text-white text-[10px] font-bold">AI</span></div></div>
                    <div class="chat-bubble-ai bg-slate-800 border border-slate-700/50 px-3 py-2.5 text-xs text-slate-200 max-w-[85%] shadow-sm">
                        ${m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}
                    </div>
                </div>`;
        }
    });
    return html;
}

function handleEnter(e) { if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendChat(); } }

function autoResizeTextarea() {
     const tx = document.getElementById('gp-chat-input');
    if (!tx) return;
    tx.addEventListener('input', function(){ this.style.height='auto'; this.style.height=this.scrollHeight+'px'; });
}

async function sendChat() {
     const input = document.getElementById('gp-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    chatHistory.push({ role:'user', text });
    input.value=''; input.style.height='auto'; input.focus();
    const box = document.getElementById('chat-box');
    const uD = document.createElement('div');
    uD.className='flex justify-end mb-3 animate__animated animate__fadeInUp animate__faster';
    uD.innerHTML=`<div class="chat-bubble-user bg-indigo-600 px-3 py-2.5 text-xs text-white max-w-[85%] shadow-md">${text}</div>`;
    box.appendChild(uD);
    box.scrollTo({top:box.scrollHeight,behavior:'smooth'});
    const lid='msg-'+Date.now();
    const aD=document.createElement('div');
    aD.className='flex justify-start mb-3 animate__animated animate__fadeIn animate__faster';
    aD.innerHTML=`
        <div class="flex-shrink-0 mr-2 mt-0.5"><div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center"><span class="text-white text-[10px] font-bold">AI</span></div></div>
        <div id="${lid}" class="chat-bubble-ai bg-slate-800 border border-slate-700/50 px-3 py-2.5 text-xs text-slate-400 max-w-[85%] flex items-center gap-1">
            <span class="dot-bounce w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
            <span class="dot-bounce w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
            <span class="dot-bounce w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
        </div>`;
    box.appendChild(aD);
    box.scrollTo({top:box.scrollHeight,behavior:'smooth'});
    const res = await callGroq(text, `Eres el tutor de Gramática Pro. El alumno estudia: ${selectedItem?selectedItem.title:'gramática'}. ${selectedItem?'Concepto: '+selectedItem.definition:''} Usa lenguaje claro y motivador. Sé conciso (máximo 3 oraciones).`);
    chatHistory.push({role:'model',text:res||'Lo siento, intenta de nuevo.'});
    const el=document.getElementById(lid);
    if(el){
        el.className='chat-bubble-ai bg-slate-800 border border-slate-700/50 px-3 py-2.5 text-xs text-slate-200 max-w-[85%] shadow-sm';
        el.innerHTML=(res||'Lo siento, intenta de nuevo.').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
        box.scrollTo({top:box.scrollHeight,behavior:'smooth'});
    }
}

function getIcon(name, color, size='w-5 h-5') {
    const icons = {
        Zap:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
        Tag:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>`,
        Palette:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>`,
        Box:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
        Target:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        Gift:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12V8H4v4m16 0H4m16 0v8H4v-8m16 0l-4-4m-8 4l4-4m4 4v8m-8-8v8"/></svg>`,
        Clock:`<svg class="${size} ${color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };
    return icons[name]||'';
}

function render() {
    const container = document.getElementById('app-content');
    const isNewView = currentView !== lastView;
    lastView = currentView;
  
   // DESPUÉS
const gpBackBtn = document.querySelector('.gp-back-btn');
if (gpBackBtn) {
    if (currentView === 'menu') {
        gpBackBtn.onclick = () => switchTab('ia-juegos');
        gpBackBtn.innerHTML = `<span class="gp-back-text-desktop"><i class="fa-solid fa-arrow-left"></i> Volver</span><span class="gp-back-text-mobile">&lt;</span>`;
    } else {
        gpBackBtn.onclick = () => showView('menu');
        gpBackBtn.innerHTML = `<span class="gp-back-text-desktop"><i class="fa-solid fa-arrow-left"></i> Volver al temario</span><span class="gp-back-text-mobile">&lt;&lt;</span>`;
    }
}

    if (currentView === 'menu') {
        container.innerHTML = `
            <div class="${isNewView?'animate__animated animate__fadeIn':''}">
                <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-6 md:mb-8">
                    <div class="flex-1">
                        <h1 class="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">Desbloquea el Lenguaje</h1>
                        <p class="text-slate-400 text-sm md:text-base">Haz clic en una tarjeta y empieza a aprender.</p>
                    </div>
                    <div class="flex bg-slate-800/50 p-1 rounded-xl border border-white/5 w-full sm:w-auto flex-wrap">
                        ${sectionsData.map(s => `
                            <button onclick="setTab('${s.id}')" class="flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${activeTab===s.id?'bg-indigo-600 text-white shadow':'text-slate-400 hover:text-white hover:bg-white/5'}">
                                ${s.title}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                    ${sectionsData.length === 0 ? `
                        <div class="col-span-full text-center py-12">
                            <div class="flex justify-center mb-4">
                                <div class="flex gap-1.5">
                                    <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                                    <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                                    <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                                </div>
                            </div>
                            <p class="text-white font-bold text-base mb-1">Cargando contenido...</p>
                            <p class="text-slate-500 text-xs">Conectando con la base de datos</p>
                        </div>
                    ` : ''}
                    ${(sectionsData.find(s => s.id === activeTab)?.cards || []).map((item, idx) => `
                        <div onclick="showDetail('${item.id}')" class="card-hover bg-slate-800/40 border border-white/5 rounded-2xl p-4 md:p-5 cursor-pointer flex flex-col h-full relative overflow-hidden group animate__animated animate__fadeInUp" style="animation-delay:${idx*0.06}s">
                            <div class="absolute -top-8 -right-8 w-28 h-28 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl pointer-events-none"></div>
                            <div class="p-2.5 rounded-xl ${item.bg} ${item.border} border mb-3 inline-block w-fit">
                                ${getIcon(item.icon, item.color, 'w-4 h-4 md:w-5 md:h-5')}
                            </div>
                            <h3 class="text-base md:text-lg font-bold text-white mb-1.5 tracking-tight">${item.title}</h3>
                            ${attemptedCards.includes(item.id) ? `
    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full mb-1.5">
        📖 En proceso
    </span>` : ''}
                         
                        </div>
                    `).join('')}
                </div>
            </div>`;

    } else if (currentView === 'detail') {
        container.innerHTML = `
            <div class="${isNewView?'animate__animated animate__fadeIn':''}">
                <div class="flex flex-col lg:flex-row gap-4 md:gap-5 items-start">

                    <!-- ── Panel principal ── -->
                    <div class="w-full lg:w-3/5 xl:w-2/3">
                        <div class="detail-card bg-slate-800/40 border border-white/5 rounded-2xl p-4 md:p-6 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-48 h-48 bg-indigo-500/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            <!-- Icono + título -->
                            <div class="flex items-center gap-3 mb-3 relative z-10">
                                <div class="p-2.5 rounded-xl ${selectedItem.bg} ${selectedItem.border} border shrink-0">
                                    ${getIcon(selectedItem.icon, selectedItem.color, 'w-5 h-5 md:w-6 md:h-6')}
                                </div>
                                <div>
                                    <h2 class="text-xl md:text-2xl font-black text-white tracking-tight">${selectedItem.title}</h2>
                                    <p class="text-xs text-slate-400 mt-0.5">${selectedItem.definition}</p>
                                </div>
                            </div>

                            <!-- Secreto -->
                            <div class="bg-gradient-to-r from-indigo-900/40 to-slate-800/40 border border-indigo-500/20 p-3.5 md:p-5 rounded-xl mb-3 relative z-10">
                                <div class="flex items-center gap-1.5 text-indigo-300 font-bold text-[10px] tracking-wider uppercase mb-1.5">
                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    El secreto para encontrarlo:
                                </div>
                                <p class="text-sm md:text-base font-bold text-white leading-snug">"${selectedItem.how_to_find}"</p>
                            </div>

                            <!-- Pro tip -->
                            ${selectedItem.tip?`
                            <div class="bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl mb-4 relative z-10 flex gap-2.5">
                                <span class="text-base">💡</span>
                                <div>
                                    <p class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">Pro tip</p>
                                    <p class="text-xs text-slate-300">${selectedItem.tip}</p>
                                </div>
                            </div>`:''}

                            <!-- Botón -->
                            <button onclick="startLevel('${selectedItem.id}')" class="ai-sparkle-btn w-full sm:w-auto px-5 btn-primary text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 relative z-10">
                                <span class="sparkle-icon">${sparkle(18,'sg_det','#ffffff','#c7d2fe')}</span>
                                Empezar Práctica
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- ── Chat ── -->
                    <div class="w-full lg:w-2/5 xl:w-1/3 flex flex-col bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden" style="height:380px; lg:height:auto;">
                        <!-- Header chat -->
                        <div class="bg-slate-800/80 backdrop-blur-md px-3 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                            <div class="relative">
                                <div class="w-1.5 h-1.5 bg-green-500 rounded-full absolute -top-0.5 -right-0.5 border border-slate-900"></div>
                                <div class="p-1 bg-indigo-500/20 rounded-lg">${sparkle(16,'sg_ch')}</div>
                            </div>
                            <div>
                                <h3 class="font-bold text-white text-xs">Tutor IA</h3>
                                <p class="text-[9px] text-green-400 font-medium">En línea · Pregúntame lo que quieras</p>
                            </div>
                        </div>
                        <!-- Mensajes -->
                        <div id="chat-box" class="flex-1 overflow-y-auto p-3 flex flex-col scroll-smooth bg-slate-900">
                            ${generateChatHTML()}
                        </div>
                        <!-- Input -->
                        <div class="p-2.5 bg-slate-800/50 border-t border-white/5 shrink-0">
                            <div class="flex items-end gap-2">
                                <textarea id="gp-chat-input" onkeypress="handleEnter(event)"rows="1"
                                    class="flex-1 bg-slate-900 rounded-xl px-3 py-2 text-xs text-white border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none resize-none"
                                    placeholder="Escribe tu duda aquí..."
                                    style="min-height:36px;max-height:90px;"></textarea>
                                <button onclick="sendChat()" class="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-colors shrink-0">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>`;

        setTimeout(()=>{
            const b=document.getElementById('chat-box');
            if(b) b.scrollTop=b.scrollHeight;
            autoResizeTextarea();
    
            const chatEl = document.querySelector('.lg\\:w-2\\/5');
            if(chatEl && window.innerWidth >= 1024) {
                chatEl.style.height = 'calc(100vh - 9rem)';
                chatEl.style.position = 'sticky';
                chatEl.style.top = '4.5rem';
            }
        },50);

    } else if (currentView === 'game') {

        if (gameData.error) {
            container.innerHTML = `
                <div class="max-w-lg mx-auto animate__animated animate__fadeIn">
                    <div class="bg-slate-800/50 border border-red-500/20 rounded-2xl p-8 md:p-12 shadow-xl text-center">
                        <div class="text-5xl mb-4">⚠️</div>
                        <p class="text-white font-bold text-base mb-1">No se pudo conectar con la IA</p>
                        <p class="text-slate-500 text-xs mb-6">Revisa tu conexión a internet e inténtalo de nuevo.</p>
                        <button onclick="showView('menu')" class="btn-primary text-white font-bold py-3 px-6 rounded-xl text-sm">
                            Volver al menú
                        </button>
                    </div>
                </div>`;
            return;
        }

        if (gameData.loading || gameData.questions.length === 0) {
            container.innerHTML = `
                <div class="max-w-lg mx-auto animate__animated animate__fadeIn">
                    <div class="bg-slate-800/50 border border-white/5 rounded-2xl p-8 md:p-12 shadow-xl text-center">
                        <div class="flex justify-center mb-4">${sparkle(40,'sg_load')}</div>
                        <div class="flex justify-center gap-1.5 mb-4">
                            <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                            <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                            <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                        </div>
                        <p class="text-white font-bold text-base mb-1">Cargando tus ejercicios...</p>
                        <p class="text-slate-500 text-xs">Preparando preguntas desde la base de datos</p>
                    </div>
                </div>`;
            return;
        }

        const q    = gameData.questions[gameData.qIdx];
        const item = q.itemRef;

        container.innerHTML = `
            <div class="max-w-xl mx-auto ${isNewView?'animate__animated animate__zoomIn animate__faster':''}">
                <div class="game-card bg-slate-800/50 border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl relative overflow-hidden">

                    <!-- Cabecera -->
                    <div class="flex justify-between items-center mb-5">
                        <button onclick="showView('menu')" class="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 px-2.5 py-1.5 rounded-lg">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            Salir
                        </button>
                        <div class="flex gap-2">
                            <div class="stat-badge bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 flex flex-col items-center min-w-[52px]">
                                <span class="text-[8px] text-indigo-300 font-bold uppercase tracking-wider">Puntos</span>
                                <span class="text-sm text-white font-black leading-tight">${gameData.score}</span>
                            </div>
                            <div class="stat-badge bg-orange-500/10 px-2.5 py-1.5 rounded-lg border border-orange-500/20 flex flex-col items-center min-w-[52px]">
                                <span class="text-[8px] text-orange-300 font-bold uppercase tracking-wider">Racha</span>
                                <span class="text-sm text-white font-black leading-tight">${gameData.streak > 0 ? `<span class="${gameData.streak>=3?'fire-anim':''}">🔥</span>${gameData.streak}` : '—'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Pregunta -->
                    <div class="text-center mb-4">
                        <div class="flex flex-wrap justify-center gap-1.5 mb-2">
                            ${q.multiItems && q.multiItems.length > 0
                                ? q.multiItems.map(it => `
                                    <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/40 border border-slate-600/30">
                                        ${getIcon(it.icon, it.color, 'w-2.5 h-2.5')}
                                        <span class="text-[9px] font-bold ${it.color}">${it.title}</span>
                                    </div>`).join('')
                                : `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/40 border border-slate-600/30">
                                        ${item ? getIcon(item.icon, item.color, 'w-3 h-3') : ''}
                                        <span class="text-[10px] font-bold ${item ? item.color : ''}">${item ? item.title : ''}</span>
                                    </div>`
                            }
                        </div>
                        <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 block">Pregunta ${gameData.qIdx+1} de ${gameData.questions.length}</span>
                        <h2 class="text-lg md:text-xl font-black text-white">${q.instruction}</h2>
                    </div>

                    <!-- Oración -->
                    <div class="bg-slate-900/70 border border-slate-700/40 rounded-xl p-4 mb-4 text-center">
                        <p class="sentence-text text-base md:text-lg font-semibold text-white leading-relaxed">${q.sentence}</p>
                    </div>

                    <!-- Input -->
                    ${!gameData.feedback ? `
                    <div class="space-y-2 mb-4">
                        <div class="flex gap-2 items-center">
                            <input
                                id="game-input"
                                type="text"
                                placeholder="Escribe tu respuesta aquí..."
                                onkeydown="handleGameEnter(event)"
                                ${gameData.evaluating ? 'disabled' : ''}
                                autocomplete="off" autocorrect="off" spellcheck="false"
                                class="flex-1 bg-slate-900 border-2 ${gameData.evaluating ? 'border-slate-700 opacity-60' : 'border-slate-700 focus:border-indigo-500'} rounded-xl px-3 py-2.5 text-white text-sm font-medium placeholder-slate-600 outline-none transition-all"
                            />
                            <button onclick="handleSubmit()" ${gameData.evaluating ? 'disabled' : ''} class="btn-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 flex items-center gap-1.5 ${gameData.evaluating ? 'opacity-60' : ''}">
                                ${gameData.evaluating
                                    ? `<span class="dot-bounce w-1.5 h-1.5 bg-white rounded-full inline-block"></span>
                                       <span class="dot-bounce w-1.5 h-1.5 bg-white rounded-full inline-block"></span>
                                       <span class="dot-bounce w-1.5 h-1.5 bg-white rounded-full inline-block"></span>`
                                    : `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`
                                }
                            </button>
                        </div>
                        <p class="text-[10px] text-center text-slate-600">${gameData.evaluating ? 'La IA está analizando tu respuesta...' : 'Presiona Enter o el botón para comprobar'}</p>
                    </div>` : ''}

                    <!-- Feedback -->
                    <div class="min-h-[100px]">
                        ${gameData.feedback ? `
    
   <div class="animate__animated animate__fadeInUp animate__faster space-y-2.5">
                                <div class="p-3.5 rounded-xl ${gameData.feedback.correct?'bg-emerald-500/10 border-emerald-500/30':'bg-red-500/10 border-red-500/30'} border flex items-start gap-2.5">
                                    <div class="mt-0.5 shrink-0">
                                        ${gameData.feedback.correct
                                            ? '<svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>'
                                            : '<svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>'}
                                    </div>
                                    <div>
                                        <p class="text-white font-bold text-sm mb-0.5">${gameData.feedback.correct ? '¡Excelente!' : '¡Casi!'}</p>
                                        <p class="text-slate-300 text-xs leading-relaxed">${gameData.feedback.explanation}</p>
                                        ${!gameData.feedback.correct && gameData.feedback.correctAnswers?.length ? `<p class="text-[10px] text-slate-500 mt-1">Respuesta esperada: <span class="text-emerald-400 font-semibold">${gameData.feedback.correctAnswers.join(', ')}</span></p>` : ''}
                                    </div>
                                </div>

                                ${gameData.aiExp ? `
                                <div class="bg-indigo-900/30 p-3.5 rounded-xl text-xs text-indigo-100 border border-indigo-500/30 flex items-start gap-2">
                                    <span class="shrink-0 mt-0.5">${sparkle(14,'sg_exp')}</span>
                                    <div>${gameData.aiExp}</div>
                                </div>` : ''}

                                ${!gameData.feedback.correct && !gameData.aiExp ? `
                                <button id="btn-ai" onclick="getAiExplanation()" class="w-full text-indigo-400 text-xs bg-indigo-500/5 border border-indigo-500/20 py-2 rounded-xl font-bold hover:bg-indigo-500/10 transition-colors flex justify-center items-center gap-1.5">
                                    <span>${sparkle(13,'sg_btn')}</span>
                                    Pedir explicación a la IA
                                </button>` : ''}

                                <button onclick="nextQ()" class="w-full bg-white text-slate-900 font-bold py-3 rounded-xl text-sm hover:bg-slate-200 hover:shadow-lg transition-all mt-1">
                                    ${gameData.qIdx < gameData.questions.length-1 ? 'Siguiente Pregunta →' : 'Ver Resultados Finales'}
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>`;

        if (!gameData.feedback && !gameData.evaluating) {
            setTimeout(() => { const i = document.getElementById('game-input'); if(i) i.focus(); }, 80);
        }

    } else if (currentView === 'results') {
        const pct   = gameData.questions.length > 0 ? Math.round((gameData.score/gameData.questions.length)*100) : 0;
        const emoji = pct>=80?'🏆':pct>=60?'🌟':'💪';
        container.innerHTML = `
            <div class="max-w-xs md:max-w-sm mx-auto text-center ${isNewView?'animate__animated animate__zoomIn':''}">
                <div class="bg-slate-800/60 border border-white/5 p-6 md:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-t from-indigo-900/20 to-transparent pointer-events-none"></div>
                    <div class="text-5xl md:text-6xl mb-4 drop-shadow-lg">${emoji}</div>
                    <h2 class="text-xl md:text-2xl font-black text-white mb-1 tracking-tight">¡Práctica Finalizada!</h2>
                    <p class="text-slate-400 text-xs mb-6">Has completado el desafío con éxito.</p>
                    <div class="grid grid-cols-2 gap-3 mb-6">
                        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-white/5 shadow-inner">
                            <p class="text-3xl font-black text-white">${gameData.score}</p>
                            <p class="text-[10px] text-slate-500 font-bold uppercase mt-0.5 tracking-wider">Aciertos</p>
                        </div>
                        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-white/5 shadow-inner">
                            <p class="text-3xl font-black text-orange-300">${gameData.bestStreak}</p>
                            <p class="text-[10px] text-slate-500 font-bold uppercase mt-0.5 tracking-wider">Racha Máx</p>
                        </div>
                    </div>
                    <div class="bg-slate-900/60 rounded-xl p-3 mb-4 border border-white/5">
                        <p class="text-xs text-slate-400 mb-0.5">Precisión</p>
                        <div class="w-full bg-slate-700 rounded-full h-2 mb-1">
                            <div class="h-2 rounded-full ${pct>=80?'bg-emerald-500':pct>=60?'bg-amber-500':'bg-red-500'} transition-all" style="width:${pct}%"></div>
                        </div>
                        <p class="text-sm font-black text-white">${pct}%</p>
                    </div>
                    <button onclick="showView('menu')" class="w-full btn-primary text-white font-bold py-3 rounded-xl shadow-lg text-sm">
                        Volver al Temario
                    </button>
                </div>
                
                 ${(() => {
                    const todasLasCards = sectionsData.flatMap(s => s.cards);
                    const todasCompletadas = todasLasCards.length > 0 &&
                        todasLasCards.every(c => attemptedCards.includes(c.id));
                    const btnDesafio = document.getElementById('btn-desafio-global');
                    if (btnDesafio) btnDesafio.style.display = todasCompletadas ? 'flex' : 'none';
                    return todasCompletadas ? `
                        <div style="margin-top:2rem;background:linear-gradient(135deg,rgba(79,70,229,0.2),rgba(59,130,246,0.2));border:1px solid rgba(99,102,241,0.4);border-radius:1rem;padding:1.5rem;text-align:center;">
                            <p style="color:#e2e8f0;font-weight:700;font-size:1rem;margin-bottom:1rem;">
                                ¡Has completado todas las oraciones y has desbloqueado el Desafío Global! ✨
                            </p>
                            <button onclick="startLevel('global')"
                                style="background:linear-gradient(135deg,#4f46e5,#3b82f6);color:white;border:none;padding:0.75rem 2rem;border-radius:0.75rem;font-weight:800;font-size:0.95rem;cursor:pointer;letter-spacing:1px;">
                                [ IR AL DESAFÍO ]
                            </button>
                        </div>` : '';
                })()}
                
            </div>`;
    }
}


function setTab(tab) { activeTab = tab; render(); }
function showView(v) { currentView = v; render(); }
function showDetail(id) {
    
    const todasLasTarjetas = sectionsData.flatMap(s => s.cards);
    selectedItem = todasLasTarjetas.find(c => c.id === id);
    currentView  = 'detail';
    chatHistory  = [];
    render();
}

async function initGramaticaPro() {
    if (_gpInicializado) return;
    _gpInicializado = true;

    // Mostrar loader inmediato
    const container = document.getElementById('app-content');
    if (container) {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:1rem;">
                <div style="display:flex;gap:8px;">
                    <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                    <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                    <span class="dot-bounce w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                </div>
                <p style="color:#94a3b8;font-size:0.85rem;font-weight:600;">Cargando contenido...</p>
            </div>`;
    }

    await gp_cargarProgreso();
    await loadData();
    setupRealtime();
    render();
}

// ============================================
// CUA CUA QUEST — LÓGICA COMPLETA
// ============================================

const CCQ_KEY = "AIzaSyDyqNtd8buo1sIXK7ey2YE-F5g1G3E6-jg";

let ccqDocText        = "";
let ccqVerifiedModel  = "";
let ccqCurrentQuestions = [];
let ccqCurrentMode    = '';
let ccqCorrectCount   = 0;
const CCQ_TOTAL       = 5;

// ── Abrir la sección ──
function abrirCuaCuaQuest() {
    switchTab('cuacua-app');
    ccq_initApp();
}

// ── Inicializar el input de archivo (solo una vez) ──
function ccq_initApp() {
    const input = document.getElementById('ccq-file-input');
    if (input && !input._ccqReady) {
        input._ccqReady = true;
        input.addEventListener('change', ccq_onFileChange);
    }
    // Mostrar los botones de opciones en modo grid
    const optBox = document.getElementById('ccq-options-box');
    if (optBox) optBox.style.display = 'none';
}

// ── Volver al inicio desde el logo del topbar ──
function ccq_resetApp() {
    ['ccq-quiz-output','ccq-processing','ccq-results-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const optBox = document.getElementById('ccq-options-box');
    if (optBox) { optBox.classList.add('hidden'); optBox.style.display = 'none'; }
    document.getElementById('ccq-upload').classList.remove('hidden');
    document.getElementById('ccq-file-ready').classList.add('hidden');
    ccqDocText = '';
    const fileInput = document.getElementById('ccq-file-input');
    if (fileInput) fileInput.value = '';
}

// ── Leer el archivo subido ──
async function ccq_onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('ccq-name-tag').innerText = file.name;
    document.getElementById('ccq-file-ready').classList.remove('hidden');

    // Mostrar opciones
    const optBox = document.getElementById('ccq-options-box');
    optBox.classList.remove('hidden');
    optBox.style.display = 'grid';

    document.getElementById('ccq-quiz-output').classList.add('hidden');
    document.getElementById('ccq-results-panel').classList.add('hidden');

    try {
        if (file.name.endsWith('.docx')) {
            const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            ccqDocText = res.value;
        } else if (file.name.endsWith('.pdf')) {
            // Usamos el worker que coincide con la versión de tu página (3.11.174)
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
            let t = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page    = await pdf.getPage(i);
                const content = await page.getTextContent();
                t += content.items.map(s => s.str).join(" ") + " ";
            }
            ccqDocText = t;
        } else {
            ccqDocText = await file.text();
        }
    } catch (err) {
        alert("Error al leer el archivo: " + err.message);
    }
}

// ── Obtener el modelo de Gemini disponible ──
async function ccq_getWorkingModel() {
    if (ccqVerifiedModel) return ccqVerifiedModel;
    try {
        const req  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${CCQ_KEY}`);
        const data = await req.json();
        if (data.models) {
            const valid = data.models.find(
                m => m.name.includes("gemini") &&
                     m.supportedGenerationMethods.includes("generateContent")
            );
            if (valid) { ccqVerifiedModel = valid.name; return ccqVerifiedModel; }
        }
    } catch (e) {}
    return "models/gemini-1.5-flash";
}

// ── Generar preguntas con IA ──
async function ccq_process(mode) {
    if (!ccqDocText) { alert("Primero sube un documento."); return; }

    document.getElementById('ccq-processing').classList.remove('hidden');
    const optBox = document.getElementById('ccq-options-box');
    optBox.classList.add('hidden'); optBox.style.display = 'none';

    try {
        const modelToUse = await ccq_getWorkingModel();
        const queryType  = mode === 'multiple_choice'
            ? "5 preguntas de opción múltiple con 4 alternativas"
            : "5 afirmaciones de verdadero o falso con exactamente 2 alternativas: Verdadero y Falso";

        const prompt = `IMPORTANTE: NO escribas saludos, NO digas "Aquí tienes", NO uses formato markdown. Responde ÚNICA Y EXCLUSIVAMENTE con el objeto JSON.
Genera ${queryType} basadas en este texto.
El JSON debe ser exactamente así: {"data":[{"q":"pregunta","o":["opcion1","opcion2","opcion3","opcion4"],"a":0}]}
Texto: ${ccqDocText.substring(0, 6000)}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/${modelToUse}:generateContent?key=${CCQ_KEY}`;
        const r   = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                contents:         [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        const j = await r.json();
        if (!r.ok)          throw new Error(j.error?.message || "Error desconocido.");
        if (!j.candidates)  throw new Error("Google no devolvió respuesta.");

        const textResponse = j.candidates[0].content.parts[0].text;
        const startIndex   = textResponse.indexOf('{');
        const endIndex     = textResponse.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1)
            throw new Error("La IA no generó el formato correcto. Intenta de nuevo.");

        const finalData       = JSON.parse(textResponse.substring(startIndex, endIndex + 1)).data;
        ccqCurrentQuestions   = finalData;
        ccqCurrentMode        = mode;
        ccqCorrectCount       = 0;
        ccq_render(finalData);

    } catch (e) {
        alert("Error al procesar las preguntas:\n\n" + e.message);
        const optBox2 = document.getElementById('ccq-options-box');
        optBox2.classList.remove('hidden'); optBox2.style.display = 'grid';
    } finally {
        document.getElementById('ccq-processing').classList.add('hidden');
    }
}

// ── Mostrar las preguntas ──
function ccq_render(data) {
    const container = document.getElementById('ccq-container');
    container.innerHTML = "";
    document.getElementById('ccq-quiz-output').classList.remove('hidden');

    data.forEach((item, i) => {
        const div       = document.createElement('div');
        div.className   = "ccq-glass-panel";
        div.style.cssText = "padding:1.25rem; border-left:4px solid #2563eb; margin-bottom:1rem;";

        const opts = ccqCurrentMode === 'true_false' ? item.o.slice(0, 2) : item.o;
        const optionsHTML = opts.map((o, idx) => `
            <button onclick="ccq_verify(this, ${idx}, ${item.a})" class="ccq-option-item">${o}</button>
        `).join('');

        div.innerHTML = `
            <p style="font-size:0.875rem; font-weight:700; margin-bottom:1rem; color:var(--text-light);">
                ${i + 1}. ${item.q}
            </p>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">${optionsHTML}</div>
        `;
        container.appendChild(div);
    });

    document.getElementById('ccq-quiz-output').scrollIntoView({ behavior: 'smooth' });
}

// ── Verificar respuesta al hacer clic ──
function ccq_verify(btn, sel, ok) {
    const btns = btn.parentElement.children;
    for (let b of btns) {
        b.disabled          = true;
        b.style.opacity     = "0.5";
        b.style.cursor      = "not-allowed";
    }
    btn.style.opacity = "1";

    if (sel === ok) {
        btn.style.backgroundColor = 'rgba(16,185,129,0.3)';
        btn.style.borderColor     = '#10b981';
        btn.style.color           = '#6ee7b7';
        btn.innerHTML            += ' <span style="float:right;color:#10b981;font-weight:600;">✓ Bien</span>';
        ccqCorrectCount++;
    } else {
        btn.style.backgroundColor = 'rgba(239,68,68,0.3)';
        btn.style.borderColor     = '#ef4444';
        btn.style.color           = '#fca5a5';
        btn.innerHTML            += ' <span style="float:right;color:#ef4444;font-weight:600;">✕ Incorrecto</span>';
        if (btns[ok]) {
            setTimeout(() => {
                btns[ok].style.backgroundColor = 'rgba(16,185,129,0.3)';
                btns[ok].style.borderColor      = '#10b981';
                btns[ok].style.color            = '#6ee7b7';
                btns[ok].style.opacity          = "1";
                btns[ok].innerHTML             += ' <span style="float:right;color:#10b981;font-weight:600;">✓ Respuesta</span>';
            }, 2000);
        }
    }

    // Si ya contestaste las 5 preguntas → mostrar resultados
    const allQ        = document.getElementById('ccq-container').querySelectorAll('.ccq-glass-panel');
    const answered    = Array.from(allQ).filter(q => q.querySelector('button[disabled]')).length;
    if (answered === CCQ_TOTAL) {
        setTimeout(() => { ccq_showResults(); }, 2000);
    }
}

// ── Mostrar panel de resultados ──
function ccq_showResults() {
    document.getElementById('ccq-quiz-output').classList.add('hidden');
    document.getElementById('ccq-results-panel').classList.remove('hidden');
    const incorrect = CCQ_TOTAL - ccqCorrectCount;
    const pct       = Math.round((ccqCorrectCount / CCQ_TOTAL) * 100);
    document.getElementById('ccq-correct-count').textContent   = ccqCorrectCount;
    document.getElementById('ccq-incorrect-count').textContent = incorrect;
    document.getElementById('ccq-score-percentage').textContent = pct + '%';
}

// ── Reintentar el mismo cuestionario ──
function ccq_retrySameQuiz() {
    document.getElementById('ccq-results-panel').classList.add('hidden');
    document.getElementById('ccq-quiz-output').classList.remove('hidden');
    ccqCorrectCount = 0;
    ccq_render(ccqCurrentQuestions);
}

// ── Generar un nuevo cuestionario con el mismo documento ──
function ccq_generateNextQuiz() {
    document.getElementById('ccq-results-panel').classList.add('hidden');
    document.getElementById('ccq-quiz-output').classList.add('hidden');
    document.getElementById('ccq-processing').classList.remove('hidden');
    document.getElementById('ccq-loading-text').textContent = ccqCurrentMode === 'multiple_choice'
        ? "Cargando nuevas preguntas de opción múltiple..."
        : "Cargando nuevas afirmaciones de verdadero/falso...";
    ccqCorrectCount = 0;
    if (ccqCurrentMode) ccq_process(ccqCurrentMode);
}
