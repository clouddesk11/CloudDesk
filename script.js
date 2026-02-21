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
const auth = firebase.auth();

// ============================================
// TIPO DE DISPOSITIVO
// ============================================
function getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'mobile';
    if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android.*mobile/i.test(ua)) return 'mobile';
    return 'desktop';
}

// ============================================
// UI HELPERS
// ============================================
function showConnectionLoader() { const l = document.getElementById('connectionLoader'); if (l) l.style.display = 'flex'; }
function hideConnectionLoader() { const l = document.getElementById('connectionLoader'); if (l) l.style.display = 'none'; }
function showAuthModal()        { const m = document.getElementById('authModal');        if (m) m.style.display = 'flex'; }
function hideAuthModal()        { const m = document.getElementById('authModal');        if (m) m.style.display = 'none'; }

// ============================================
// SESSION TEMP STORAGE
// ============================================
const _TV_KEY = '_cdsk_tv';
let _registrandoAhora = false;

function _getTempValidacion() {
    try { const r = sessionStorage.getItem(_TV_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
}
function _setTempValidacion(val) {
    try {
        if (val !== null && val !== undefined) sessionStorage.setItem(_TV_KEY, JSON.stringify(val));
        else sessionStorage.removeItem(_TV_KEY);
    } catch(e) { console.error('sessionStorage error:', e); }
}

// ============================================
// ROUTING POR DISPOSITIVO
// ============================================
function _mostrarPasoInicial() {
    if (getDeviceType() === 'desktop') mostrarPasoDesktop();
    else mostrarPaso1();
}

function _ocultarTodosLosPasos() {
    ['auth-step-code','auth-step-registro','auth-step-google',
     'auth-step-api','auth-step-desktop','auth-step-desktop-google'
    ].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

// ============================================
// PASO 1 MÓVIL — Nombre + Código
// ============================================
function mostrarPaso1() {
    _ocultarTodosLosPasos();
    document.getElementById('auth-step-code').style.display = 'block';
    ['authError','googleError','authRegistroError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
    const btn = document.getElementById('authSubmit');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; }
}

// ============================================
// PASO 2 MÓVIL — Especialidad + Ciclo + Foto
// ============================================
function mostrarPasoRegistro() {
    _ocultarTodosLosPasos();
    document.getElementById('auth-step-registro').style.display = 'block';
    const errReg = document.getElementById('authRegistroError');
    if (errReg) { errReg.textContent = ''; errReg.style.display = 'none'; }
    const esp  = document.getElementById('selectEspecialidad');
    const ciclo = document.getElementById('selectCiclo');
    if (esp)  esp.value  = '';
    if (ciclo) ciclo.value = '';
    resetImagePreview();
    selectedImageFile    = null;
    selectedImageDataUrl = '';
    selectedEspecialidad = '';
    selectedCiclo        = '';
}

// ============================================
// PASO 3 MÓVIL — Google Sign-in
// ============================================
function mostrarPaso2Google() {
    _ocultarTodosLosPasos();
    document.getElementById('auth-step-google').style.display = 'block';
    const errGoogle = document.getElementById('googleError');
    if (errGoogle) { errGoogle.style.display = 'none'; errGoogle.textContent = ''; }
    const btn = document.getElementById('googleSignInBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
    const tv = _getTempValidacion();
    if (tv) {
        const infoEl = document.getElementById('auth-codigo-validado');
        if (infoEl) infoEl.textContent = `✅ Código "${tv.codigo}" verificado. Ahora vincula tu cuenta de Google.`;
    }
}

// ============================================
// PASO 4 MÓVIL — Mostrar API (solo tras auth exitosa)
// ============================================
function mostrarPasoAPI(apiNum, userName) {
    _ocultarTodosLosPasos();
    document.getElementById('auth-step-api').style.display = 'block';
    const greetingEl = document.getElementById('api-reveal-greeting');
    if (greetingEl) greetingEl.textContent = `Hola ${userName || ''}, esto es tu API para ingresar por el dispositivo de laptop:`;
    const numEl = document.getElementById('api-number-value');
    if (numEl) numEl.textContent = apiNum || '—';
}

// ============================================
// CERRAR MODAL TRAS VER EL API
// ============================================
function cerrarAuthConAPI() {
    hideAuthModal();
    actualizarPerfilSidebar();
    const authData = localStorage.getItem('eduspace_auth');
    if (authData) {
        try {
            const { codigo } = JSON.parse(authData);
            iniciarListenerBloqueo();
            if (codigo === '6578hy') showSpecialUserMessage();
        } catch(e) {}
    }
}

// ============================================
// DESKTOP PASO 1 — Input de API numérico
// ============================================
function mostrarPasoDesktop() {
    _ocultarTodosLosPasos();
    document.getElementById('auth-step-desktop').style.display = 'block';
    const errEl = document.getElementById('desktop-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const btn = document.getElementById('desktop-api-btn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Verificar API'; }
    const input = document.getElementById('desktop-api-input');
    if (input) input.value = '';
}

function volverAlAPIDesktop() { _setTempValidacion(null); mostrarPasoDesktop(); }

// ============================================
// DESKTOP: Validar API contra Firebase
// ============================================
async function validarAPIDesktop() {
    const apiInput = document.getElementById('desktop-api-input').value.trim();
    const errorDiv = document.getElementById('desktop-error');
    const btn      = document.getElementById('desktop-api-btn');

    errorDiv.style.display = 'none';
    if (!apiInput || isNaN(apiInput) || Number(apiInput) <= 0) {
        errorDiv.textContent = '⚠️ Por favor ingresa un API válido (solo números).';
        errorDiv.style.display = 'block'; return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

    try {
        const snap = await database.ref('codigos').orderByChild('api').equalTo(Number(apiInput)).once('value');
        if (!snap.exists()) {
            errorDiv.textContent = '❌ API inválido. Verifica que sea el número correcto.';
            errorDiv.style.display = 'block';
            btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Verificar API'; return;
        }

        const codigos    = snap.val();
        const codigoKey  = Object.keys(codigos)[0];
        const codigoData = codigos[codigoKey];

        if (codigoData.bloqueado === true) {
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${codigoData.motivoBloqueo || 'Acceso denegado.'}`;
            errorDiv.style.display = 'block';
            btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Verificar API'; return;
        }

        if (!codigoData.googleUidPropietario) {
            errorDiv.textContent = '⚠️ Este API aún no está activado. Primero regístrate desde tu dispositivo móvil.';
            errorDiv.style.display = 'block';
            btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Verificar API'; return;
        }

        const userName = codigoData.propietario
            || (codigoData.perfilEstudiante && codigoData.perfilEstudiante.nombre)
            || 'Usuario';

        _setTempValidacion({ api: Number(apiInput), codigo: codigoKey, codigoData, expectedGoogleUid: codigoData.googleUidPropietario, userName });
        mostrarPasoGoogleDesktop();

    } catch(err) {
        errorDiv.textContent = '❌ Error de conexión: ' + err.message;
        errorDiv.style.display = 'block';
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Verificar API';
    }
}

// ============================================
// DESKTOP PASO 2 — Google Sign-in
// ============================================
function mostrarPasoGoogleDesktop() {
    _ocultarTodosLosPasos();
    document.getElementById('auth-step-desktop-google').style.display = 'block';
    const errEl = document.getElementById('desktop-google-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    const btn = document.getElementById('desktop-google-btn');
    if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
}

// ============================================
// DESKTOP: Sign-in Google (verifica UID)
// ============================================
async function signInWithGoogleDesktop() {
    const btn      = document.getElementById('desktop-google-btn');
    const errorDiv = document.getElementById('desktop-google-error');
    const tempVal  = _getTempValidacion();

    if (!tempVal) { errorDiv.textContent = '⚠️ Sesión expirada. Recarga la página.'; errorDiv.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
    errorDiv.style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        _registrandoAhora = true;
        const result = await auth.signInWithPopup(provider);

        if (result.user.uid !== tempVal.expectedGoogleUid) {
            await auth.signOut();
            errorDiv.textContent = '🚫 Esta cuenta de Google no corresponde al API ingresado. Usa la misma cuenta con la que te registraste en móvil.';
            errorDiv.style.display = 'block';
            btn.disabled = false; btn.innerHTML = googleBtnHTML(); return;
        }

        await completarRegistroDesktop(result.user, tempVal);

    } catch(err) {
        let msg = '❌ Error al iniciar sesión con Google.';
        if (err.code === 'auth/popup-closed-by-user') msg = '⚠️ Cerraste la ventana de Google. Intenta nuevamente.';
        else if (err.code === 'auth/popup-blocked')   msg = '⚠️ El navegador bloqueó la ventana. Permite ventanas emergentes.';
        errorDiv.textContent = msg; errorDiv.style.display = 'block';
        btn.disabled = false; btn.innerHTML = googleBtnHTML();
    } finally { _registrandoAhora = false; }
}

// ============================================
// DESKTOP: Completar registro
// ============================================
async function completarRegistroDesktop(user, tempVal) {
    const { codigo } = tempVal;
    const googleUid  = user.uid;
    const deviceKey  = `${googleUid}_desktop`;

    try {
        const snap      = await database.ref(`codigos/${codigo}`).once('value');
        const freshData = snap.val();
        if (!freshData) { await _cerrarSesionYMostrarErrorDesktop('❌ El código ya no existe.'); return; }
        if (freshData.bloqueado) { await _cerrarSesionYMostrarErrorDesktop(`🚫 ACCESO BLOQUEADO: ${freshData.motivoBloqueo || ''}`); return; }

        const dispositivos = freshData.dispositivos || {};

        if (dispositivos[deviceKey]) {
            await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`).set(new Date().toISOString());
        } else {
            const { desktop } = contarDispositivosPorTipo(dispositivos);
            if (desktop >= 1) { await _cerrarSesionYMostrarErrorDesktop('💻 Este API ya está en uso en otra laptop. Solo se permite 1 laptop por código.'); return; }
            if (Object.keys(dispositivos).length >= 2) { await _cerrarSesionYMostrarErrorDesktop('⚠️ Este código ya alcanzó el límite de 2 dispositivos.'); return; }

            const userName = freshData.propietario
                || (freshData.perfilEstudiante && freshData.perfilEstudiante.nombre) || 'Usuario';

            const updates = {};
            updates[`codigos/${codigo}/dispositivos/${deviceKey}`] = {
                googleUid, googleEmail: user.email, tipo: 'desktop',
                usuario: userName, fechaRegistro: new Date().toISOString(), ultimoAcceso: new Date().toISOString()
            };
            const total = Object.keys(dispositivos).length + 1;
            updates[`codigos/${codigo}/usosRestantes`] = Math.max(0, 2 - total);
            if (total >= 2) updates[`codigos/${codigo}/completado`] = true;
            await database.ref().update(updates);
        }

        // Cargar perfil desde Firebase → localStorage
        if (freshData.perfilEstudiante) {
            localStorage.setItem('eduspace_student_profile', JSON.stringify({
                nombre:              freshData.perfilEstudiante.nombre      || '',
                especialidad:        freshData.perfilEstudiante.especialidad || '',
                ciclo:               freshData.perfilEstudiante.ciclo        || '',
                foto_url:            freshData.perfilEstudiante.foto_url     || '',
                supabase_registered: freshData.perfilEstudiante.supabase_registered || false
            }));
        }

        const userName = freshData.propietario
            || (freshData.perfilEstudiante && freshData.perfilEstudiante.nombre) || 'Usuario';
        _guardarSesionLocal(userName, codigo, googleUid, 'desktop');
        _setTempValidacion(null);
        hideAuthModal();
        actualizarPerfilSidebar();
        iniciarListenerBloqueo();
        if (codigo === '6578hy') showSpecialUserMessage();

    } catch(err) {
        console.error('completarRegistroDesktop error:', err);
        await _cerrarSesionYMostrarErrorDesktop('❌ Error de conexión: ' + err.message);
    }
}

async function _cerrarSesionYMostrarErrorDesktop(mensaje) {
    const user = auth.currentUser;
    if (user) { try { await user.delete(); } catch(e) { await auth.signOut().catch(console.error); } }
    localStorage.removeItem('eduspace_auth');
    _setTempValidacion(null);
    showAuthModal(); mostrarPasoDesktop();
    const errEl = document.getElementById('desktop-error');
    if (errEl) { errEl.innerHTML = mensaje; errEl.style.display = 'block'; }
}

// ============================================
// MÓVIL: Google Sign-in
// ============================================
async function signInWithGoogle() {
    const btn      = document.getElementById('googleSignInBtn');
    const errorDiv = document.getElementById('googleError');
    if (!_getTempValidacion()) { errorDiv.textContent = '⚠️ Error interno. Recarga la página.'; errorDiv.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
    errorDiv.style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        _registrandoAhora = true;
        const result = await auth.signInWithPopup(provider);
        await completarRegistro(result.user);
    } catch(error) {
        let msg = '❌ Error al iniciar sesión con Google.';
        if (error.code === 'auth/popup-closed-by-user') msg = '⚠️ Cerraste la ventana de Google.';
        else if (error.code === 'auth/popup-blocked')   msg = '⚠️ El navegador bloqueó la ventana emergente.';
        errorDiv.textContent = msg; errorDiv.style.display = 'block';
        btn.disabled = false; btn.innerHTML = googleBtnHTML();
    } finally { _registrandoAhora = false; }
}

// ============================================
// SVG BOTÓN GOOGLE
// ============================================
function googleBtnHTML() {
    return `<svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
        <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg> Continuar con Google`;
}

// ============================================
// NORMALIZAR NOMBRE
// ============================================
function normalizarNombre(nombre) {
    return nombre.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

// ============================================
// PASO 1 MÓVIL: Validar nombre + código
// ============================================
async function validarCodigo() {
    const userName  = document.getElementById('authUserName').value.trim();
    const codigo    = document.getElementById('authCode').value.trim();
    const errorDiv  = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    errorDiv.style.display = 'none'; errorDiv.textContent = '';
    if (!userName) { errorDiv.textContent = 'Por favor, ingresa tu nombre.'; errorDiv.style.display = 'block'; return; }
    if (!codigo)   { errorDiv.textContent = 'Por favor, ingresa tu código.'; errorDiv.style.display = 'block'; return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

    try {
        let snapshot;
        try { snapshot = await database.ref(`codigos/${codigo}`).once('value'); }
        catch(fbError) {
            errorDiv.textContent = '⚠️ Error de conexión. Verifica tu internet.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return;
        }

        if (!snapshot.exists()) {
            errorDiv.textContent = '❌ Código inválido. Verifica con el administrador.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return;
        }

        const codigoData    = snapshot.val();
        const dispositivos  = codigoData.dispositivos || {};
        const dispKeys      = Object.keys(dispositivos);

        if (codigoData.bloqueado === true) {
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${codigoData.motivoBloqueo || 'Acceso denegado.'}`;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return;
        }

        // Capa A: propietario explícito
        if (codigoData.propietario && codigoData.propietario.trim()) {
            if (normalizarNombre(userName) !== normalizarNombre(codigoData.propietario)) {
                errorDiv.innerHTML = `❌ El nombre no coincide con el registrado para este código.<br><small>Escríbelo exactamente como el administrador lo registró.</small>`;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return;
            }
        }
        // Capa B: candado automático del primer dispositivo
        else if (dispKeys.length > 0) {
            let primerNombre = '';
            for (const key of dispKeys) {
                const u = (dispositivos[key].usuario || '').trim();
                if (u) { primerNombre = u; break; }
            }
            if (primerNombre && normalizarNombre(userName) !== normalizarNombre(primerNombre)) {
                errorDiv.innerHTML = `❌ El nombre no coincide con el titular de este código.`;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar'; return;
            }
        }

        _setTempValidacion({ userName, codigo, codigoData });
        submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';

        const user            = auth.currentUser;
        const perfilExistente = localStorage.getItem('eduspace_student_profile');

        if (user) {
            if (perfilExistente) await completarRegistro(user);
            else mostrarPasoRegistro();
        } else {
            if (perfilExistente) mostrarPaso2Google();
            else mostrarPasoRegistro();
        }

    } catch(error) {
        console.error('validarCodigo error:', error);
        errorDiv.textContent = '❌ Error de conexión. Intenta nuevamente.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

// ============================================
// CONTINUAR DESDE PASO PERFIL
// ============================================
function continuarDesdeAuth() {
    const esp  = document.getElementById('selectEspecialidad').value;
    const ciclo = document.getElementById('selectCiclo').value;
    const errEl = document.getElementById('authRegistroError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    if (!esp || !ciclo) {
        if (errEl) { errEl.textContent = '⚠️ Por favor selecciona tu especialidad y ciclo.'; errEl.style.display = 'block'; } return;
    }
    if (!selectedImageFile) {
        if (errEl) { errEl.textContent = '⚠️ Por favor selecciona una foto de perfil.'; errEl.style.display = 'block'; } return;
    }
    selectedEspecialidad = esp;
    selectedCiclo        = ciclo;
    mostrarPaso2Google();
}

// ============================================
// COMPLETAR REGISTRO MÓVIL
// ============================================
async function completarRegistro(user) {
    if (!_getTempValidacion()) { await auth.signOut(); showAuthModal(); mostrarPaso1(); return; }
    const { userName, codigo } = _getTempValidacion();
    const googleUid  = user.uid;
    const deviceType = getDeviceType();
    const deviceKey  = `${googleUid}_${deviceType}`;
    const googleBtn  = document.getElementById('googleSignInBtn');
    const googleErr  = document.getElementById('googleError');
    if (googleBtn) { googleBtn.disabled = true; googleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...'; }
    if (googleErr)  googleErr.style.display = 'none';

    try {
        const snapshot   = await database.ref(`codigos/${codigo}`).once('value');
        const codigoData = snapshot.val();
        if (!codigoData) { await _cerrarSesionYMostrarError('❌ El código ya no existe.'); return; }
        if (codigoData.bloqueado) { await _cerrarSesionYMostrarError(`🚫 ACCESO BLOQUEADO: ${codigoData.motivoBloqueo || ''}`); return; }

        const dispositivos = codigoData.dispositivos || {};

        // Dispositivo ya registrado
        if (dispositivos[deviceKey]) {
            await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}`).update({
                usuario: userName, ultimoAcceso: new Date().toISOString()
            });
            _guardarSesionLocal(userName, codigo, googleUid, deviceType);
            _setTempValidacion(null);
            await _sincronizarPerfilDesdeFirebase(codigoData);
            hideAuthModal();
            actualizarPerfilSidebar();
            iniciarListenerBloqueo();
            if (codigo === '6578hy') showSpecialUserMessage();
            return;
        }

        // Verificar que no haya otra cuenta Google
        const otraCuenta = Object.values(dispositivos).find(d => d.googleUid && d.googleUid !== googleUid);
        if (otraCuenta) { await _cerrarSesionYMostrarError('🚫 Este código ya está vinculado a otra cuenta de Google.'); return; }

        // Verificar límites
        const { mobile, desktop } = contarDispositivosPorTipo(dispositivos);
        if (deviceType === 'mobile'  && mobile  >= 1) { await _cerrarSesionYMostrarError('📱 Límite de móviles alcanzado (1 máx).'); return; }
        if (deviceType === 'desktop' && desktop >= 1) { await _cerrarSesionYMostrarError('💻 Límite de laptops alcanzado (1 máx).'); return; }
        if (Object.keys(dispositivos).length >= 2)    { await _cerrarSesionYMostrarError('⚠️ Código con límite de 2 dispositivos alcanzado.'); return; }

        // Registrar nuevo dispositivo
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${deviceKey}`] = {
            googleUid, googleEmail: user.email, tipo: deviceType,
            usuario: userName, fechaRegistro: new Date().toISOString(), ultimoAcceso: new Date().toISOString()
        };
        const total = Object.keys(dispositivos).length + 1;
        updates[`codigos/${codigo}/usosRestantes`] = Math.max(0, 2 - total);
        if (total >= 2) updates[`codigos/${codigo}/completado`] = true;

        // Guardar UID del propietario (solo en móvil)
        if (deviceType === 'mobile' && !codigoData.googleUidPropietario) {
            updates[`codigos/${codigo}/googleUidPropietario`] = googleUid;
        }
        await database.ref().update(updates);

        _guardarSesionLocal(userName, codigo, googleUid, deviceType);
        _setTempValidacion(null);
        iniciarListenerBloqueo();
        if (codigo === '6578hy') showSpecialUserMessage();

        // Guardar perfil + mostrar API (solo en móvil)
        await _guardarPerfilEstudianteDesdAuth(userName, codigo, codigoData);

    } catch(error) {
        console.error('completarRegistro error:', error);
        if (googleBtn) { googleBtn.disabled = false; googleBtn.innerHTML = googleBtnHTML(); }
        if (googleErr) { googleErr.textContent = '❌ Error de conexión. Intenta nuevamente.'; googleErr.style.display = 'block'; }
    } finally { _registrandoAhora = false; }
}

// ============================================
// GUARDAR PERFIL + SUBIR FOTO + MOSTRAR API
// ============================================
async function _guardarPerfilEstudianteDesdAuth(userName, codigo, codigoData) {
    const perfilExistente = localStorage.getItem('eduspace_student_profile');
    if (perfilExistente) { hideAuthModal(); actualizarPerfilSidebar(); return; }
    if (!selectedImageFile && !selectedImageDataUrl) { hideAuthModal(); actualizarPerfilSidebar(); return; }

    try {
        let fotoUrl = selectedImageDataUrl;
        if (selectedImageFile) {
            const formData = new FormData();
            formData.append('file', selectedImageFile);
            formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
            formData.append('folder', 'estudiantes_clouddesk');
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
            if (res.ok) { const data = await res.json(); fotoUrl = data.secure_url; }
        }

        const perfilData = { nombre: userName, especialidad: selectedEspecialidad, ciclo: selectedCiclo, foto_url: fotoUrl, supabase_registered: false };
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfilData));

        // Guardar en Firebase para que laptop pueda cargarlo
        if (codigo) await database.ref(`codigos/${codigo}/perfilEstudiante`).set(perfilData);

        // Mostrar API si está configurado
        const snapFresh = await database.ref(`codigos/${codigo}`).once('value');
        const freshData = snapFresh.val();
        const apiNum    = freshData ? freshData.api : null;

        if (apiNum !== undefined && apiNum !== null) {
            mostrarPasoAPI(apiNum, userName);
        } else {
            hideAuthModal();
            actualizarPerfilSidebar();
        }

    } catch(err) {
        console.error('_guardarPerfilEstudianteDesdAuth error:', err);
        if (selectedImageDataUrl) {
            localStorage.setItem('eduspace_student_profile', JSON.stringify({
                nombre: userName, especialidad: selectedEspecialidad,
                ciclo: selectedCiclo, foto_url: selectedImageDataUrl, supabase_registered: false
            }));
        }
        hideAuthModal(); actualizarPerfilSidebar();
    }
}

// ── Sincronizar perfil desde Firebase (para laptop / usuario que regresa) ──
async function _sincronizarPerfilDesdeFirebase(codigoData) {
    const perfilLocal = localStorage.getItem('eduspace_student_profile');
    if (!perfilLocal && codigoData && codigoData.perfilEstudiante) {
        localStorage.setItem('eduspace_student_profile', JSON.stringify({
            nombre:             codigoData.perfilEstudiante.nombre      || '',
            especialidad:       codigoData.perfilEstudiante.especialidad || '',
            ciclo:              codigoData.perfilEstudiante.ciclo        || '',
            foto_url:           codigoData.perfilEstudiante.foto_url     || '',
            supabase_registered: codigoData.perfilEstudiante.supabase_registered || false
        }));
    }
}

// ── Guardar sesión local ──
function _guardarSesionLocal(userName, codigo, googleUid, deviceType) {
    localStorage.setItem('eduspace_auth', JSON.stringify({ userName, codigo, googleUid, deviceType, timestamp: Date.now() }));
}

// ── Error handler móvil ──
async function _cerrarSesionYMostrarError(mensaje) {
    const user = auth.currentUser;
    if (user) { try { await user.delete(); } catch(e) { await auth.signOut().catch(console.error); } }
    localStorage.removeItem('eduspace_auth');
    _setTempValidacion(null);
    showAuthModal(); mostrarPaso1();
    const errDiv = document.getElementById('authError');
    if (errDiv) { errDiv.innerHTML = mensaje; errDiv.style.display = 'block'; }
}

// ============================================
// VALIDAR AUTH CON FIREBASE (sesión guardada)
// ============================================
async function validateAuthWithFirebase(googleUid) {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return false;

    try {
        const parsed = JSON.parse(authData);
        const { codigo, userName } = parsed;
        if (parsed.googleUid !== googleUid) { localStorage.removeItem('eduspace_auth'); return false; }

        const snapshot   = await database.ref(`codigos/${codigo}`).once('value');
        const codigoData = snapshot.val();
        if (!codigoData) { localStorage.removeItem('eduspace_auth'); showAuthError('Código inválido o eliminado.'); return false; }
        if (codigoData.bloqueado) { localStorage.removeItem('eduspace_auth'); showAuthError(`🚫 ACCESO BLOQUEADO: ${codigoData.motivoBloqueo || ''}`); return false; }

        // Validar nombre
        if (codigoData.propietario && codigoData.propietario.trim()) {
            if (normalizarNombre(userName || '') !== normalizarNombre(codigoData.propietario)) {
                localStorage.removeItem('eduspace_auth'); showAuthError('⚠️ Sesión inválida. Ingresa de nuevo.'); return false;
            }
        }

        const dispositivos = codigoData.dispositivos || {};
        const deviceType   = parsed.deviceType || getDeviceType();
        const deviceKey    = `${googleUid}_${deviceType}`;
        if (!dispositivos[deviceKey]) { localStorage.removeItem('eduspace_auth'); showAuthError('Este dispositivo no está autorizado.'); return false; }

        await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`).set(new Date().toISOString());
        await _sincronizarPerfilDesdeFirebase(codigoData);
        if (codigo === '6578hy') showSpecialUserMessage();
        return true;

    } catch(e) { console.error('validateAuth error:', e); localStorage.removeItem('eduspace_auth'); return false; }
}

function contarDispositivosPorTipo(dispositivos) {
    let mobile = 0, desktop = 0;
    Object.values(dispositivos).forEach(d => { if (d.tipo === 'mobile') mobile++; else if (d.tipo === 'desktop') desktop++; });
    return { mobile, desktop };
}

function showAuthError(message) {
    const stepDesk = document.getElementById('auth-step-desktop');
    if (stepDesk && stepDesk.style.display !== 'none') {
        const el = document.getElementById('desktop-error');
        if (el) { el.innerHTML = message; el.style.display = 'block'; }
    } else {
        const el = document.getElementById('authError');
        if (el) { el.innerHTML = message; el.style.display = 'block'; }
    }
}

function showSpecialUserMessage() { const el = document.getElementById('specialUserMessage'); if (el) el.style.display = 'flex'; }
function hideSpecialUserMessage() { const el = document.getElementById('specialUserMessage'); if (el) el.style.display = 'none'; }

async function cerrarSesionYReingresar() {
    closeRegistroModal();
    await auth.signOut().catch(console.error);
    localStorage.removeItem('eduspace_auth');
    localStorage.removeItem('eduspace_student_profile');
    _setTempValidacion(null);
    showAuthModal();
    _mostrarPasoInicial();
}

// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================
let _appInicializada = false;

document.addEventListener('DOMContentLoaded', async () => {
    showConnectionLoader();

    // Enter handlers
    document.getElementById('authSubmit')?.addEventListener('click', validarCodigo);
    document.getElementById('authUserName')?.addEventListener('keypress', e => { if (e.key === 'Enter') validarCodigo(); });
    document.getElementById('authCode')?.addEventListener('keypress',     e => { if (e.key === 'Enter') validarCodigo(); });
    document.getElementById('desktop-api-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') validarAPIDesktop(); });

    auth.onAuthStateChanged(async (user) => {
        hideConnectionLoader();

        if (user) {
            const authData = localStorage.getItem('eduspace_auth');
            if (authData) {
                const ok = await validateAuthWithFirebase(user.uid);
                if (ok) { hideAuthModal(); iniciarListenerBloqueo(); actualizarPerfilSidebar(); }
                else    { showAuthModal(); _mostrarPasoInicial(); }
            } else {
                if (_registrandoAhora) return;
                try { await user.delete(); } catch(e) { await auth.signOut().catch(console.error); }
                showAuthModal(); _mostrarPasoInicial();
            }
        } else {
            showAuthModal(); _mostrarPasoInicial();
        }

        if (!_appInicializada) {
            _appInicializada = true;
            updatePendingBadge();
            actualizarPerfilSidebar();
            switchTab('repositorio');
            initSupabase();
        }
    });

    // Términos checkbox
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
                if (fotoConfirm && perfil.foto_url) fotoConfirm.src = perfil.foto_url;

                terminosContainer.style.transition = 'opacity .3s ease, transform .3s ease';
                terminosContainer.style.opacity    = '0';
                terminosContainer.style.transform  = 'translateY(-20px)';
                setTimeout(() => {
                    terminosContainer.style.display = 'none';
                    formRegistro.style.display      = 'block';
                    formRegistro.style.opacity      = '0';
                    formRegistro.style.transform    = 'translateY(20px)';
                    setTimeout(() => {
                        formRegistro.style.transition = 'opacity .3s ease, transform .3s ease';
                        formRegistro.style.opacity    = '1';
                        formRegistro.style.transform  = 'translateY(0)';
                    }, 10);
                }, 300);
            } else {
                formRegistro.style.opacity   = '0';
                formRegistro.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    formRegistro.style.display        = 'none';
                    terminosContainer.style.display   = 'block';
                    terminosContainer.style.opacity   = '0';
                    terminosContainer.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        terminosContainer.style.opacity   = '1';
                        terminosContainer.style.transform = 'translateY(0)';
                    }, 10);
                }, 300);
            }
        });
    }
});

// ============================================
// LISTENER DE BLOQUEO EN TIEMPO REAL
// ============================================
let bloqueoListener = null;

function iniciarListenerBloqueo() {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return;
    try {
        const { codigo } = JSON.parse(authData);
        if (bloqueoListener) database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener);
        bloqueoListener = database.ref(`codigos/${codigo}/bloqueado`).on('value', (snapshot) => {
            if (snapshot.val() === true) {
                database.ref(`codigos/${codigo}/motivoBloqueo`).once('value', async (motivoSnap) => {
                    const motivo = motivoSnap.val() || 'Tu acceso ha sido bloqueado.';
                    await auth.signOut().catch(console.error);
                    localStorage.removeItem('eduspace_auth');
                    _setTempValidacion(null);
                    showAuthModal(); _mostrarPasoInicial();
                    showAuthError(`🚫 ACCESO BLOQUEADO: ${motivo}`);
                    hideSpecialUserMessage();
                });
            } else if (snapshot.val() === false) {
                const authDataNow = localStorage.getItem('eduspace_auth');
                const user = auth.currentUser;
                if (authDataNow && user) {
                    validateAuthWithFirebase(user.uid).then(ok => {
                        if (ok) {
                            hideAuthModal();
                            const { codigo: c } = JSON.parse(authDataNow);
                            if (c === '6578hy') showSpecialUserMessage();
                            mostrarNotificacionDesbloqueo();
                        }
                    });
                }
            }
        });
    } catch(e) { console.error('iniciarListenerBloqueo error:', e); }
}

function mostrarNotificacionDesbloqueo() {
    const n = document.createElement('div');
    n.innerHTML = `<i class="fa-solid fa-check-circle" style="font-size:1.5rem;"></i><span>Tu acceso ha sido restaurado</span>`;
    n.style.cssText = 'position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#10b981,#0d9668);color:white;padding:1rem 1.5rem;border-radius:12px;box-shadow:0 4px 15px rgba(16,185,129,.4);display:flex;align-items:center;gap:10px;font-weight:600;z-index:9999;animation:slideInRight .5s ease;';
    document.body.appendChild(n);
    setTimeout(() => { n.style.animation = 'slideOutRight .5s ease'; setTimeout(() => n.remove(), 500); }, 5000);
}

window.addEventListener('beforeunload', () => {
    const authData = localStorage.getItem('eduspace_auth');
    if (authData && bloqueoListener) {
        try { const { codigo } = JSON.parse(authData); database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener); }
        catch(e) { console.error(e); }
    }
});

// ============================================
// BASE DE DATOS
// ============================================
const teachersDB = {
    "Prof. Alejandro Ruiz": { name:"Prof. Alejandro Ruiz", title:"Profesor de Matemáticas", photo:"https://i.pravatar.cc/150?img=12", email:"alejandro.ruiz@eduspace.com", phone:"+51 987 654 321" },
    "Dra. María González":  { name:"Dra. María González",  title:"Doctora en Biológicas",   photo:"https://i.pravatar.cc/150?img=12", email:"maria.gonzalez@eduspace.com",  phone:"+51 987 654 322" },
    "Lic. Carlos Fuentes":  { name:"Lic. Carlos Fuentes",  title:"Licenciado en Literatura", photo:"https://i.pravatar.cc/150?img=12", email:"carlos.fuentes@eduspace.com",  phone:"+51 987 654 323" },
    "Prof. Diana Prince":   { name:"Prof. Diana Prince",   title:"Profesora de Historia",    photo:"https://i.pravatar.cc/150?img=12", email:"diana.prince@eduspace.com",    phone:"+51 987 654 324" }
};

const filesDB = [
    { id:1, title:"Guía de Álgebra Avanzada",       area:"Matemáticas", teacher:"Prof. Alejandro Ruiz", date:"2025-05-10", type:"PDF",  urlView:"https://docs.google.com/document/d/1u223FM_asu6nkbkHdYPc48QyOMow7sDH/edit?usp=drive_link&ouid=110125860748103327612&rtpof=true&sd=true", urlDownload:"https://res.cloudinary.com/dwzwa3gp0/raw/upload/v1766695102/D%C3%89FICIT_DE_PROYECTO_DE_INVESTIGACI%C3%93N_mxcrj4.docx" },
    { id:2, title:"La Célula y sus partes",          area:"Ciencias",    teacher:"Dra. María González",  date:"2025-05-12", type:"PPTX", urlView:"https://docs.google.com/presentation/d/1234567890/preview", urlDownload:"https://docs.google.com/presentation/d/1234567890/export/pptx" },
    { id:3, title:"Ensayo: Realismo Mágico",         area:"Literatura",  teacher:"Lic. Carlos Fuentes",  date:"2025-05-14", type:"DOCX", urlView:"https://docs.google.com/document/d/1234567890/preview", urlDownload:"https://docs.google.com/document/d/1234567890/export?format=docx" },
    { id:4, title:"Revolución Industrial",           area:"Historia",    teacher:"Prof. Diana Prince",   date:"2025-05-15", type:"PDF",  urlView:"https://drive.google.com/file/d/1234567890/preview", urlDownload:"https://drive.google.com/uc?export=download&id=1234567890" },
    { id:5, title:"Ejercicios de Trigonometría",     area:"Matemáticas", teacher:"Prof. Alejandro Ruiz", date:"2025-05-18", type:"PDF",  urlView:"https://drive.google.com/file/d/0987654321/preview", urlDownload:"https://drive.google.com/uc?export=download&id=0987654321" }
];

const assignmentsDB = [
    { id:101, task:"Informe de Laboratorio #3", teacher:"Dra. María González", deadline:"2025-05-25", status:"Pendiente",
      description:"Realizar un informe completo sobre el experimento de fotosíntesis realizado en clase.",
      requirements:["Mínimo 5 páginas, máximo 8","Incluir gráficos y tablas","Referencias en formato APA","Análisis crítico","Conclusiones basadas en evidencia"],
      attachments:[{ name:"Guía del Informe.pdf", size:"245 KB", type:"PDF", downloadUrl:"enlace de google drive" },{ name:"Datos del Experimento.xlsx", size:"128 KB", type:"Excel", downloadUrl:"enlace desde google drive" }] },
    { id:102, task:"Análisis de 'Cien Años de Soledad'", teacher:"Lic. Carlos Fuentes", deadline:"2025-05-20", status:"Pendiente",
      description:"Análisis literario profundo de la obra de García Márquez.",
      requirements:["Ensayo de 6-8 páginas","Análisis de 3 personajes principales","Identificar elementos del realismo mágico","Contexto histórico","Citas textuales"],
      attachments:[{ name:"Rúbrica.pdf", size:"156 KB", type:"PDF", downloadUrl:"enlace de google drive" }] },
    { id:103, task:"Línea de tiempo S.XIX", teacher:"Prof. Diana Prince", deadline:"2025-05-10", status:"Pendiente",
      description:"Línea de tiempo interactiva con eventos del siglo XIX.",
      requirements:["Mínimo 20 eventos","Incluir imágenes","50-100 palabras por evento","Formato digital","Presentación visual atractiva"],
      attachments:[{ name:"Plantilla Línea de Tiempo.pptx", size:"512 KB", type:"PowerPoint", downloadUrl:"enlace de google drive" }] }
];

const recursosDB = {
    Materiales: {
        Documentos: [
            { id:'mat-doc-1', title:"Manual de Redacción Periodística", description:"Guía completa sobre técnicas de redacción", type:"PDF", coverImage:"https://via.placeholder.com/400x250/3b82f6/ffffff?text=Manual+Redaccion", urlView:"https://drive.google.com/file/d/EJEMPLO1/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO1" },
            { id:'mat-doc-2', title:"Teorías de la Comunicación", description:"Documento sobre las principales teorías comunicativas", type:"PDF", coverImage:"https://via.placeholder.com/400x250/2563eb/ffffff?text=Teorias", urlView:"https://drive.google.com/file/d/EJEMPLO2/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO2" }
        ],
        Videos: [{ id:'mat-vid-1', title:"Introducción a la Comunicación Digital", description:"Video tutorial sobre fundamentos de comunicación", type:"Video", videoUrl:"https://www.youtube.com/embed/dQw4w9WgXcQ" }],
        Imágenes: [{ id:'mat-img-1', title:"Infografía: Proceso Comunicativo", description:"Modelo de Shannon y Weaver", type:"Imagen", imageUrl:"https://via.placeholder.com/600x400/10b981/ffffff?text=Proceso+Comunicativo" }]
    },
    Cuentos: {
        Documentos: [{ id:'cue-doc-1', title:"Antología de Cuentos Latinoamericanos", description:"Colección de cuentos clásicos", type:"PDF", coverImage:"https://via.placeholder.com/400x250/f59e0b/ffffff?text=Cuentos", urlView:"https://drive.google.com/file/d/EJEMPLO3/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO3" }],
        Videos: [{ id:'cue-vid-1', title:"Cuentos en Video", description:"Narración audiovisual", type:"Video", videoUrl:"https://www.youtube.com/embed/dQw4w9WgXcQ" }],
        Imágenes: [{ id:'cue-img-1', title:"Portadas de Cuentos", description:"Ilustraciones", type:"Imagen", imageUrl:"https://res.cloudinary.com/dwzwa3gp0/image/upload/v1769784312/image_89_anqelh.jpg" }]
    },
    Historias: {
        Documentos: [{ id:'his-doc-1', title:"Historias de la Comunicación Peruana", description:"Desarrollo de los medios en Perú", type:"DOCX", coverImage:"https://via.placeholder.com/400x250/ef4444/ffffff?text=Historias", urlView:"https://docs.google.com/document/d/EJEMPLO4/preview", urlDownload:"https://docs.google.com/document/d/EJEMPLO4/export?format=docx" }],
        Videos: [], Imágenes: []
    },
    Leyendas: {
        Documentos: [{ id:'ley-doc-1', title:"Leyendas Peruanas Ilustradas", description:"Leyendas tradicionales del Perú", type:"PDF", coverImage:"https://via.placeholder.com/400x250/8b5cf6/ffffff?text=Leyendas", urlView:"https://drive.google.com/file/d/EJEMPLO5/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO5" }],
        Videos: [], Imágenes: []
    },
    Poemas: {
        Documentos: [{ id:'poe-doc-1', title:"Poesía Contemporánea Peruana", description:"Selección de poemas peruanos", type:"PDF", coverImage:"https://via.placeholder.com/400x250/ec4899/ffffff?text=Poesia", urlView:"https://drive.google.com/file/d/EJEMPLO6/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO6" }],
        Videos: [], Imágenes: []
    },
    Libros: [
        { id:'lib-1', title:"Comunicación Organizacional Moderna", description:"Estrategias de comunicación en organizaciones", type:"PDF", coverImage:"https://via.placeholder.com/400x250/06b6d4/ffffff?text=Comunicacion", urlView:"https://drive.google.com/file/d/EJEMPLO7/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO7" },
        { id:'lib-2', title:"Semiótica y Análisis del Discurso", description:"Análisis semiótico aplicado a la comunicación", type:"PDF", coverImage:"https://via.placeholder.com/400x250/14b8a6/ffffff?text=Semiotica", urlView:"https://drive.google.com/file/d/EJEMPLO8/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO8" }
    ]
};

// ============================================
// VARIABLES GLOBALES DE UI
// ============================================
let currentFilter               = 'all';
let currentTab                  = 'repositorio';
let currentAssignmentToComplete = null;
let showingFinalizados          = false;
let fullscreenCloseBtn          = null;
let currentRecursosCategory     = 'Materiales';
let currentRecursosType         = 'Documentos';

let selectedEspecialidad = '';
let selectedCiclo        = '';
let selectedImageDataUrl = '';
let selectedImageFile    = null;

const CLOUDINARY_CONFIG = { CLOUD_NAME: "dwzwa3gp0", UPLOAD_PRESET: "hfqqxu13" };
const SUPABASE_CONFIG   = {
    URL: 'https://pauaqgfqsitnjsikrjns.supabase.co',
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdWFxZ2Zxc2l0bmpzaWtyam5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMxODYsImV4cCI6MjA4NjY2OTE4Nn0.Jz-rCRPQkgm9wXicGRoCP4xP-NotY-YEQXUyxgU7HeM'
};

let supabaseClient = null;

function initSupabase() {
    try {
        if (typeof supabase !== 'undefined') { supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY); return true; }
        return false;
    } catch(e) { console.error('Supabase init error:', e); return false; }
}

// ============================================
// UTILS
// ============================================
function getCompletedAssignments() { const c = localStorage.getItem('completedAssignments'); return c ? JSON.parse(c) : []; }
function saveCompletedAssignment(id) { const c = getCompletedAssignments(); if (!c.includes(id)) { c.push(id); localStorage.setItem('completedAssignments', JSON.stringify(c)); } }
function getPendingAssignments()  { const c = getCompletedAssignments(); return assignmentsDB.filter(a => !c.includes(a.id)); }
function getFinishedAssignments() { const c = getCompletedAssignments(); return assignmentsDB.filter(a =>  c.includes(a.id)); }

function normalizeText(t) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }

function calculateRelevance(item, terms, fields) {
    let score = 0;
    const nFields = fields.map(f => normalizeText(item[f] || ''));
    terms.forEach(term => {
        nFields.forEach((f, i) => {
            if (!f.includes(term)) return;
            if (f === term) score += 10;
            else if (f.startsWith(term)) score += 5;
            else score += 2;
            if (i === 0) score += 3;
        });
    });
    return score;
}

function updatePendingBadge() {
    const count = getPendingAssignments().length;
    const bs = document.getElementById('pending-badge');
    const bf = document.getElementById('pending-badge-footer');
    if (count > 0) { if (bs) bs.style.display='block'; if (bf) bf.style.display='block'; }
    else           { if (bs) bs.style.display='none';  if (bf) bf.style.display='none'; }
}

function mostrarToast(mensaje, icono = 'fa-check-circle', duracion = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fa-solid ${icono}"></i><span>${mensaje}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => { toast.classList.remove('toast-show'); setTimeout(() => toast.remove(), 400); }, duracion);
}

// ============================================
// SIDEBAR
// ============================================
function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        sidebar.classList.toggle('mobile-open');
        overlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
    } else {
        sidebar.classList.toggle('collapsed');
        document.getElementById('mainContent').classList.toggle('sidebar-collapsed');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('mobile-open');
    overlay.style.display = 'none';
}

// ============================================
// NAVEGACIÓN DE TABS
// ============================================
function switchTab(tab) {
    currentTab = tab;
    const sections = ['repositorio','trabajos','recursos','docentes','estudiantes'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = s === tab ? 'block' : 'none';
    });

    const tabs = ['tab-repositorio','tab-trabajos','tab-recursos','tab-docentes','tab-estudiantes'];
    tabs.forEach(t => { const el = document.getElementById(t); if (el) el.classList.remove('active'); });
    const activeTab = document.getElementById(`tab-${tab}`);
    if (activeTab) activeTab.classList.add('active');

    if (tab === 'repositorio')  renderFiles(currentFilter);
    if (tab === 'trabajos')     renderAssignments();
    if (tab === 'recursos')     renderRecursosContent();
    if (tab === 'docentes')     renderDocentes();
    if (tab === 'estudiantes')  { cargarEstudiantes(); inicializarRealtimeEstudiantes(); }

    if (window.innerWidth <= 768) closeSidebar();
}

// ============================================
// PERFIL EN SIDEBAR
// ============================================
function actualizarPerfilSidebar() {
    const wrapper = document.getElementById('sidebar-profile-wrapper');
    const imgEl   = document.getElementById('sidebar-profile-img');
    const initEl  = document.getElementById('sidebar-profile-initial');
    const nameEl  = document.getElementById('sidebar-profile-name');

    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (!perfil) { if (wrapper) wrapper.style.display = 'none'; return; }

    if (wrapper) wrapper.style.display = 'flex';

    if (perfil.foto_url) {
        if (imgEl) { imgEl.src = perfil.foto_url; imgEl.style.display = 'block'; }
        if (initEl)  initEl.style.display = 'none';
    } else {
        if (imgEl)  imgEl.style.display = 'none';
        const inicial = (perfil.nombre || '?').charAt(0).toUpperCase();
        if (initEl) { initEl.textContent = inicial; initEl.style.display = 'flex'; }
    }
    if (nameEl) nameEl.textContent = perfil.nombre || 'Mi Perfil';
}

// ============================================
// MODAL DE PERFIL (SIDEBAR)
// ============================================
function abrirPerfilEstudiante() {
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (!perfil) return;

    const modal    = document.getElementById('modal-perfil-estudiante');
    const fotoEl   = document.getElementById('perfil-modal-foto');
    const nombreEl = document.getElementById('perfil-modal-nombre');
    const espEl    = document.getElementById('perfil-modal-especialidad');
    const cicloEl  = document.getElementById('perfil-modal-ciclo');

    if (fotoEl)   fotoEl.src      = perfil.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre || '?')}&background=3b82f6&color=fff&size=200`;
    if (nombreEl) nombreEl.textContent = perfil.nombre || '—';
    if (espEl)    espEl.textContent    = perfil.especialidad || '—';
    if (cicloEl)  cicloEl.textContent  = perfil.ciclo ? `Ciclo ${perfil.ciclo}` : '—';

    if (modal) modal.style.display = 'flex';
}

function cerrarPerfilEstudiante() {
    const modal = document.getElementById('modal-perfil-estudiante');
    if (modal) modal.style.display = 'none';
}

function cambiarFotoSidebar() {
    document.getElementById('sidebar-foto-file-input')?.click();
}

async function procesarNuevaFotoPerfil(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { mostrarToast('⚠️ La imagen es muy grande. Máx. 5MB.', 'fa-exclamation-triangle'); return; }

    const perfil   = JSON.parse(localStorage.getItem('eduspace_student_profile') || '{}');
    const authData = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');

    mostrarToast('Subiendo foto...', 'fa-cloud-upload-alt', 8000);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
        formData.append('folder', 'estudiantes_clouddesk');

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
        if (!res.ok) throw new Error('Error al subir la foto.');
        const data    = await res.json();
        const fotoUrl = data.secure_url;

        perfil.foto_url = fotoUrl;
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));

        // Actualizar foto en Firebase
        if (authData.codigo) {
            await database.ref(`codigos/${authData.codigo}/perfilEstudiante/foto_url`).set(fotoUrl);
        }

        // Actualizar foto en Supabase si ya está registrado
        if (perfil.supabase_registered && supabaseClient) {
            await supabaseClient.from('estudiantes').update({ foto_url: fotoUrl }).eq('nombre_completo', perfil.nombre);
        }

        actualizarPerfilSidebar();
        abrirPerfilEstudiante(); // refrescar modal
        mostrarToast('✅ Foto actualizada exitosamente.', 'fa-check-circle');

    } catch(err) {
        console.error('procesarNuevaFotoPerfil error:', err);
        mostrarToast('❌ Error al subir la foto. Intenta nuevamente.', 'fa-exclamation-circle');
    }
    event.target.value = '';
}

// ============================================
// BUSCAR
// ============================================
function toggleSearch(section) {
    const key       = section.charAt(0).toUpperCase() + section.slice(1);
    const searchBar = document.getElementById(`searchBar${key}`);
    if (!searchBar) return;
    const input = searchBar.querySelector('input');
    searchBar.classList.toggle('active');
    if (searchBar.classList.contains('active')) setTimeout(() => input.focus(), 300);
    else { input.value = ''; if (section === 'repositorio') searchFiles(); else searchRecursos(); }
}

function searchFiles() {
    const term = document.getElementById('searchInputRepositorio')?.value.toLowerCase().trim();
    if (!term) { renderFiles(currentFilter); return; }
    const terms = normalizeText(term).split(/\s+/);
    const filtered = filesDB
        .filter(f => currentFilter === 'all' || f.area === currentFilter)
        .map(f => ({...f, relevance: calculateRelevance(f, terms, ['title','area','teacher'])}))
        .filter(f => f.relevance > 0).sort((a,b) => b.relevance - a.relevance);
    renderFilesArray(filtered);
}

function searchRecursos() {
    const term = document.getElementById('searchInputRecursos')?.value.toLowerCase().trim();
    if (!term) { renderRecursosContent(); return; }
    const terms = normalizeText(term).split(/\s+/);
    let all = [];
    Object.keys(recursosDB).forEach(cat => {
        if (cat === 'Libros') all = all.concat(recursosDB[cat].map(r => ({...r, category: cat})));
        else Object.keys(recursosDB[cat]).forEach(type => { all = all.concat(recursosDB[cat][type].map(r => ({...r, category: cat, type}))); });
    });
    const filtered = all.map(r => ({...r, relevance: calculateRelevance(r, terms, ['title','description'])})).filter(r => r.relevance > 0).sort((a,b) => b.relevance - a.relevance);
    const container = document.getElementById('recursos-container');
    if (!container) return;
    container.innerHTML = '';
    if (!filtered.length) { container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No se encontraron recursos.</p>'; return; }
    filtered.forEach(r => { if (r.type==='Video') renderVideoCard(r); else if (r.type==='Imagen') renderImageCard(r); else renderDocumentCard(r); });
}

// ============================================
// RENDER ARCHIVOS
// ============================================
function renderFiles(filter = 'all') {
    currentFilter = filter;
    const grid = document.getElementById('files-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filtered = filter === 'all' ? filesDB : filesDB.filter(f => f.area === filter);
    renderFilesArray(filtered);
}

function renderFilesArray(files) {
    const grid = document.getElementById('files-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!files.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);">No se encontraron archivos.</p>'; return; }
    files.forEach(file => {
        const teacher = teachersDB[file.teacher];
        const card    = document.createElement('div');
        card.classList.add('file-card');
        let iconClass = 'fa-file-pdf';
        if (file.type === 'DOCX' || file.type === 'DOC')      iconClass = 'fa-file-word';
        else if (file.type === 'PPTX' || file.type === 'PPT') iconClass = 'fa-file-powerpoint';
        else if (file.type === 'XLSX' || file.type === 'XLS') iconClass = 'fa-file-excel';
        card.innerHTML = `
            <div class="file-cover">
                <i class="fa-solid ${iconClass} file-cover-icon"></i>
                <span class="file-cover-badge">${file.area}</span>
            </div>
            <div class="file-card-body">
                <h3 class="file-title">${file.title}</h3>
                <div class="file-details">
                    <p><i class="fa-regular fa-calendar"></i> ${file.date}</p>
                    <div class="teacher-profile">
                        <img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar" onclick="openProfileModal('${file.teacher}')">
                        <span class="teacher-name">${teacher.name}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button onclick="viewFile('${file.urlView}')" class="btn btn-view"><i class="fa-regular fa-eye"></i> Ver</button>
                    <a href="${file.urlDownload}" download class="btn btn-download"><i class="fa-solid fa-download"></i> Descargar</a>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

function filterFiles(area) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderFiles(area);
    const inp = document.getElementById('searchInputRepositorio');
    if (inp) inp.value = '';
}

// ============================================
// RENDER RECURSOS
// ============================================
function filterRecursos(category) {
    currentRecursosCategory = category;
    currentRecursosType     = 'Documentos';
    document.querySelectorAll('.recursos-filter-btn').forEach(b => b.classList.remove('active'));
    event.target.closest('.recursos-filter-btn').classList.add('active');
    const subMenu = document.getElementById('recursosSubMenu');
    if (category === 'Libros') { subMenu.style.display = 'none'; }
    else {
        subMenu.style.display = 'flex';
        const subs = subMenu.querySelectorAll('.submenu-btn');
        subs.forEach(b => b.classList.remove('active'));
        if (subs[0]) subs[0].classList.add('active');
    }
    renderRecursosContent();
}

function toggleRecursosMenu(e, category) {
    e.stopPropagation();
    const subMenu = document.getElementById('recursosSubMenu');
    if (subMenu.style.display !== 'flex') {
        currentRecursosCategory = category; currentRecursosType = 'Documentos';
        document.querySelectorAll('.recursos-filter-btn').forEach(b => b.classList.remove('active'));
        e.target.closest('.recursos-filter-btn').classList.add('active');
        subMenu.style.display = 'flex';
        const subs = subMenu.querySelectorAll('.submenu-btn');
        subs.forEach(b => b.classList.remove('active'));
        if (subs[0]) subs[0].classList.add('active');
        renderRecursosContent();
    }
}

function filterRecursosType(type) {
    currentRecursosType = type;
    document.querySelectorAll('.submenu-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderRecursosContent();
}

function renderRecursosContent() {
    const container = document.getElementById('recursos-container');
    if (!container) return;
    container.innerHTML = '';
    let recursos = [];
    if (currentRecursosCategory === 'Libros') recursos = recursosDB.Libros;
    else { const cat = recursosDB[currentRecursosCategory]; if (cat && cat[currentRecursosType]) recursos = cat[currentRecursosType]; }
    if (!recursos.length) { container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No hay recursos disponibles.</p>'; return; }
    recursos.forEach(r => { if (r.type==='Video') renderVideoCard(r); else if (r.type==='Imagen') renderImageCard(r); else renderDocumentCard(r); });
}

function renderDocumentCard(recurso) {
    const container = document.getElementById('recursos-container');
    if (!container) return;
    const card = document.createElement('div');
    card.classList.add('recurso-card');
    let icon = 'fa-file-pdf';
    if (recurso.type==='DOCX'||recurso.type==='DOC')     icon = 'fa-file-word';
    else if (recurso.type==='PPTX'||recurso.type==='PPT') icon = 'fa-file-powerpoint';
    card.innerHTML = `
        <div class="recurso-cover">
            ${recurso.coverImage ? `<img src="${recurso.coverImage}" alt="${recurso.title}">` : `<i class="fa-solid ${icon}"></i>`}
        </div>
        <div class="recurso-card-content">
            <span class="recurso-card-type">${recurso.type}</span>
            <h3 class="recurso-card-title">${recurso.title}</h3>
            <p class="recurso-card-description">${recurso.description}</p>
            <div class="recurso-card-actions">
                <button onclick="viewFile('${recurso.urlView}')" class="btn btn-view"><i class="fa-regular fa-eye"></i> Ver</button>
                <a href="${recurso.urlDownload}" download class="btn btn-download"><i class="fa-solid fa-download"></i> Descargar</a>
            </div>
        </div>`;
    container.appendChild(card);
}

function renderVideoCard(recurso) {
    const container = document.getElementById('recursos-container');
    if (!container) return;
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');
    card.innerHTML = `<div class="recurso-multimedia-content"><iframe src="${recurso.videoUrl}" frameborder="0" allowfullscreen></iframe></div><div class="recurso-multimedia-description"><h3 style="color:var(--text-light);margin-bottom:.5rem;">${recurso.title}</h3><p>${recurso.description}</p></div>`;
    container.appendChild(card);
}

function renderImageCard(recurso) {
    const container = document.getElementById('recursos-container');
    if (!container) return;
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');
    card.innerHTML = `<div class="recurso-multimedia-content"><img src="${recurso.imageUrl}" alt="${recurso.title}"></div><div class="recurso-multimedia-description"><h3 style="color:var(--text-light);margin-bottom:.5rem;">${recurso.title}</h3><p>${recurso.description}</p></div>`;
    container.appendChild(card);
}

// ============================================
// DOCENTES
// ============================================
function renderDocentes() {
    const grid = document.getElementById('docentes-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.values(teachersDB).forEach(teacher => {
        const card = document.createElement('div');
        card.classList.add('docente-card');
        card.innerHTML = `<img src="${teacher.photo}" alt="${teacher.name}" class="docente-avatar-large"><h3 class="docente-name">${teacher.name}</h3><p class="docente-title">${teacher.title}</p><div class="docente-info"><p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p><p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p></div>`;
        grid.appendChild(card);
    });
}

// ============================================
// MODALES
// ============================================
function openProfileModal(teacherName) {
    const teacher = teachersDB[teacherName];
    if (!teacher) return;
    document.getElementById('modalProfileImage').src = teacher.photo;
    document.getElementById('modalProfileImage').alt = teacher.name;
    document.getElementById('modalProfileInfo').innerHTML = `<h3>${teacher.name}</h3><p><strong>${teacher.title}</strong></p><p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p><p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p>`;
    document.getElementById('profileModal').style.display = 'block';
}
function closeProfileModal() { document.getElementById('profileModal').style.display = 'none'; }

function viewFile(url) {
    const fc = document.getElementById('fileViewerContent');
    fc.innerHTML = `<div class="skeleton-loader"><div class="skeleton-header"><div class="skeleton-avatar"></div><div class="skeleton-text"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line medium"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    document.getElementById('fileViewerModal').style.display = 'block';
    let previewUrl = url;
    if (!previewUrl.includes('/preview')) {
        if (previewUrl.includes('/edit'))                      previewUrl = previewUrl.replace('/edit', '/preview');
        else if (previewUrl.includes('drive.google.com/file')) previewUrl = previewUrl.replace('/view', '/preview');
    }
    setTimeout(() => { fc.innerHTML = `<iframe id="googleDriveFrame" src="${previewUrl}" frameborder="0" class="google-drive-iframe"></iframe>`; }, 800);
}

function openFullscreen() {
    const iframe = document.getElementById('googleDriveFrame');
    if (!iframe) return;
    if (!fullscreenCloseBtn) {
        fullscreenCloseBtn = document.createElement('button');
        fullscreenCloseBtn.className = 'fullscreen-close-btn';
        fullscreenCloseBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
        fullscreenCloseBtn.onclick   = exitFullscreen;
        document.body.appendChild(fullscreenCloseBtn);
    }
    if (iframe.requestFullscreen) iframe.requestFullscreen().then(() => fullscreenCloseBtn.classList.add('active'));
    else if (iframe.webkitRequestFullscreen) { iframe.webkitRequestFullscreen(); fullscreenCloseBtn.classList.add('active'); }
    document.addEventListener('fullscreenchange',        handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange',  handleFullscreenChange);
}
function exitFullscreen() {
    if (document.exitFullscreen)            document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    if (fullscreenCloseBtn) fullscreenCloseBtn.classList.remove('active');
}
function handleFullscreenChange() { if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (fullscreenCloseBtn) fullscreenCloseBtn.classList.remove('active'); } }
function closeFileViewerModal() {
    document.getElementById('fileViewerModal').style.display = 'none';
    document.getElementById('fileViewerContent').innerHTML = '';
    if (document.fullscreenElement || document.webkitFullscreenElement) exitFullscreen();
}

function openDetailsModal(id) {
    const work = assignmentsDB.find(a => a.id === id);
    if (!work) return;
    const completed = getCompletedAssignments().includes(id);
    document.getElementById('detailsTaskName').textContent = work.task;
    document.getElementById('detailsTeacher').textContent  = work.teacher;
    document.getElementById('detailsDeadline').textContent = work.deadline;
    document.getElementById('detailsStatus').innerHTML     = completed
        ? `<span class="status-badge status-submitted">Finalizado</span>`
        : `<span class="status-badge status-pending">${work.status}</span>`;
    document.getElementById('detailsDescription').textContent = work.description;
    const reqList = document.getElementById('detailsRequirements');
    reqList.innerHTML = '';
    work.requirements.forEach(r => { const li = document.createElement('li'); li.textContent = r; reqList.appendChild(li); });
    const attList = document.getElementById('detailsAttachments');
    attList.innerHTML = '';
    (work.attachments || []).forEach(att => {
        const div = document.createElement('div'); div.classList.add('attachment-item');
        let icon = 'fa-file-lines';
        if (att.type==='PDF') icon='fa-file-pdf'; else if (att.type==='Word'||att.type==='DOCX') icon='fa-file-word'; else if (att.type==='Excel') icon='fa-file-excel'; else if (att.type==='PowerPoint') icon='fa-file-powerpoint';
        div.innerHTML = `<div class="attachment-info"><i class="fa-solid ${icon} attachment-icon"></i><div class="attachment-details"><h5>${att.name}</h5><p>${att.size}</p></div></div><a href="${att.downloadUrl}" target="_blank" class="attachment-download"><i class="fa-solid fa-download"></i> Descargar</a>`;
        attList.appendChild(div);
    });
    document.getElementById('detailsModal').style.display = 'block';
}
function closeDetailsModal() { document.getElementById('detailsModal').style.display = 'none'; }

function openCompletedModal(id) {
    const work    = assignmentsDB.find(a => a.id === id);
    const teacher = teachersDB[work.teacher];
    currentAssignmentToComplete = id;
    document.getElementById('completedMessage').innerHTML = `Has finalizado el trabajo de <strong>${teacher.name}</strong>:<br><br><strong>${work.task}</strong><br>Fecha límite: ${work.deadline}`;
    document.getElementById('completedModal').style.display = 'block';
}
function closeCompletedModal() { document.getElementById('completedModal').style.display = 'none'; currentAssignmentToComplete = null; }
function confirmCompleted() { if (currentAssignmentToComplete) { saveCompletedAssignment(currentAssignmentToComplete); updatePendingBadge(); renderAssignments(); closeCompletedModal(); } }

window.onclick = (e) => {
    if (e.target === document.getElementById('profileModal'))    closeProfileModal();
    if (e.target === document.getElementById('detailsModal'))    closeDetailsModal();
    if (e.target === document.getElementById('fileViewerModal')) closeFileViewerModal();
    if (e.target === document.getElementById('completedModal'))  closeCompletedModal();
};

// ============================================
// TRABAJOS
// ============================================
function renderAssignments() {
    const container = document.getElementById('assignments-container');
    if (!container) return;
    container.innerHTML = '';
    const pending = getPendingAssignments();
    if (!pending.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">¡No hay trabajos pendientes! 🎉</p>'; return; }
    pending.forEach(work => {
        const teacher = teachersDB[work.teacher];
        let statusClass = '';
        if (work.status==='Pendiente') statusClass='status-pending'; else if (work.status==='Entregado') statusClass='status-submitted'; else statusClass='status-late';
        const card = document.createElement('div');
        card.classList.add('assignment-card');
        card.innerHTML = `
            <div class="assignment-header"><h3 class="assignment-title">${work.task}</h3><span class="status-badge ${statusClass}">${work.status}</span></div>
            <div class="assignment-teacher">
                <img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar-card" onclick="openProfileModal('${work.teacher}')">
                <div class="teacher-info"><span class="teacher-info-name">${teacher.name}</span><span class="teacher-info-title">${teacher.title}</span></div>
            </div>
            <div class="assignment-meta"><div class="meta-item"><i class="fa-regular fa-calendar"></i><span>Fecha límite: ${work.deadline}</span></div></div>
            <div class="assignment-actions">
                <button class="btn btn-view"       onclick="openDetailsModal(${work.id})"><i class="fa-solid fa-info-circle"></i> Ver Detalles</button>
                <button class="btn btn-completed"  onclick="openCompletedModal(${work.id})"><i class="fa-solid fa-check-circle"></i> Cumplido</button>
            </div>`;
        container.appendChild(card);
    });
}

function renderFinalizados() {
    const container = document.getElementById('finalizados-container');
    if (!container) return;
    container.innerHTML = '';
    const finished = getFinishedAssignments();
    if (!finished.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay trabajos finalizados aún.</p>'; return; }
    finished.forEach(work => {
        const teacher = teachersDB[work.teacher];
        const card    = document.createElement('div');
        card.classList.add('assignment-card');
        card.innerHTML = `
            <div class="assignment-header"><h3 class="assignment-title">${work.task}</h3><span class="status-badge status-submitted">Finalizado</span></div>
            <div class="assignment-teacher">
                <img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar-card" onclick="openProfileModal('${work.teacher}')">
                <div class="teacher-info"><span class="teacher-info-name">${teacher.name}</span><span class="teacher-info-title">${teacher.title}</span></div>
            </div>
            <div class="assignment-meta"><div class="meta-item"><i class="fa-regular fa-calendar"></i><span>${work.deadline}</span></div></div>
            <div class="assignment-actions"><button class="btn btn-view" onclick="openDetailsModal(${work.id})"><i class="fa-solid fa-info-circle"></i> Ver Detalles</button></div>`;
        container.appendChild(card);
    });
}

function toggleTrabajosFinalizados() {
    showingFinalizados = !showingFinalizados;
    const btn   = document.getElementById('btn-trabajos-finalizados');
    const text  = document.getElementById('btn-trabajos-text');
    const icon  = btn?.querySelector('i');
    const pTitle = document.getElementById('trabajos-pendientes-title');
    const fTitle = document.getElementById('trabajos-finalizados-title');
    const pSec   = document.getElementById('trabajos-pendientes-section');
    const fSec   = document.getElementById('trabajos-finalizados-section');
    if (showingFinalizados) {
        if (pSec) pSec.style.display = 'none'; if (fSec) fSec.style.display = 'block';
        if (pTitle) pTitle.style.display = 'none'; if (fTitle) fTitle.style.display = 'block';
        if (text) text.textContent = 'Ver trabajos pendientes';
        if (icon) icon.className = 'fa-solid fa-clock';
        if (btn) btn.classList.add('showing-finalizados');
        renderFinalizados();
    } else {
        if (pSec) pSec.style.display = 'block'; if (fSec) fSec.style.display = 'none';
        if (pTitle) pTitle.style.display = 'block'; if (fTitle) fTitle.style.display = 'none';
        if (text) text.textContent = 'Ver trabajos finalizados';
        if (icon) icon.className = 'fa-solid fa-check-circle';
        if (btn) btn.classList.remove('showing-finalizados');
    }
}

// ============================================
// IMAGEN PREVIEW
// ============================================
function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('⚠️ La imagen es muy grande. Máx. 5MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('⚠️ Selecciona un archivo de imagen válido.'); return; }
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImageDataUrl = e.target.result;
        const img = document.getElementById('previewImgPaso0');
        if (img) img.src = e.target.result;
        const ph  = document.getElementById('uploadPlaceholderPaso0');
        const prev = document.getElementById('imagePreviewPaso0');
        if (ph)   ph.style.display   = 'none';
        if (prev) prev.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function resetImagePreview() {
    const ph   = document.getElementById('uploadPlaceholderPaso0');
    const prev = document.getElementById('imagePreviewPaso0');
    const img  = document.getElementById('previewImgPaso0');
    const inp  = document.getElementById('fotoInputPaso0');
    if (ph)   ph.style.display   = 'block';
    if (prev) prev.style.display = 'none';
    if (img)  img.src            = '';
    if (inp)  inp.value          = '';
    selectedImageDataUrl = '';
}

// ============================================
// REGISTRO ESTUDIANTES (SUPABASE)
// ============================================
function openRegistroModal() {
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (perfil && perfil.supabase_registered) { abrirPerfilEstudiante(); return; }
    const modal = document.getElementById('registroModal');
    if (modal) modal.style.display = 'block';
    const sinPerfil   = document.getElementById('registro-sin-perfil');
    const terminos    = document.querySelector('.terminos-container');
    const formReg     = document.getElementById('form-registro');
    const checkbox    = document.getElementById('aceptoTerminos');
    if (checkbox) checkbox.checked = false;
    if (perfil && !perfil.supabase_registered) {
        if (sinPerfil) sinPerfil.style.display = 'none';
        if (terminos) { terminos.style.display = 'block'; terminos.style.opacity = '1'; terminos.style.transform = 'translateY(0)'; terminos.style.transition = ''; }
        if (formReg)  { formReg.style.display = 'none'; formReg.style.opacity = '0'; }
    } else {
        if (sinPerfil) sinPerfil.style.display = 'block';
        if (terminos) terminos.style.display = 'none';
        if (formReg)  formReg.style.display  = 'none';
    }
}
function closeRegistroModal() { const m = document.getElementById('registroModal'); if (m) m.style.display = 'none'; }

async function registrarEstudiante() {
    if (!supabaseClient) { if (!initSupabase()) { mostrarToast('❌ Error de conexión con la base de datos.', 'fa-exclamation-circle'); return; } }
    const perfil   = JSON.parse(localStorage.getItem('eduspace_student_profile') || '{}');
    const authData = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');
    const nombre   = document.getElementById('nombreCompleto')?.value.trim() || perfil.nombre || '';

    if (!nombre) { mostrarToast('⚠️ El nombre es requerido.', 'fa-exclamation-triangle'); return; }

    const btn = document.getElementById('btnRegistrar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...'; }

    try {
        const { data: existing } = await supabaseClient.from('estudiantes').select('id').eq('nombre_completo', nombre).maybeSingle();
        if (existing) {
            mostrarToast('ℹ️ Ya estás registrado en la comunidad.', 'fa-info-circle');
            perfil.supabase_registered = true;
            localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));
            if (authData.codigo) await database.ref(`codigos/${authData.codigo}/perfilEstudiante/supabase_registered`).set(true);
            closeRegistroModal();
            cargarEstudiantes();
            return;
        }

        const { error } = await supabaseClient.from('estudiantes').insert([{
            nombre_completo: nombre,
            foto_url:        perfil.foto_url || '',
            especialidad:    perfil.especialidad || '',
            ciclo:           perfil.ciclo || ''
        }]);

        if (error) throw error;

        perfil.supabase_registered = true;
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));
        if (authData.codigo) await database.ref(`codigos/${authData.codigo}/perfilEstudiante/supabase_registered`).set(true);

        mostrarToast('✅ ¡Te has unido a la comunidad!', 'fa-user-check');
        closeRegistroModal();
        cargarEstudiantes();

    } catch(err) {
        console.error('registrarEstudiante error:', err);
        mostrarToast('❌ Error al registrarse. Intenta nuevamente.', 'fa-exclamation-circle');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Unirme Ahora'; }
    }
}

async function cargarEstudiantes() {
    if (!supabaseClient) { if (!initSupabase()) return; }
    const loadingEl = document.getElementById('loading-estudiantes');
    const grid      = document.getElementById('estudiantes-grid');
    if (!grid) return;
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const { data, error } = await supabaseClient.from('estudiantes').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (loadingEl) loadingEl.style.display = 'none';
        renderEstudiantesReales(data || []);
    } catch(err) {
        console.error('cargarEstudiantes error:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">Error al cargar estudiantes.</p>';
    }
}

function renderEstudiantesReales(estudiantes) {
    const grid = document.getElementById('estudiantes-grid');
    if (!grid) return;
    const loadingEl = document.getElementById('loading-estudiantes');
    if (loadingEl) { grid.innerHTML = ''; grid.appendChild(loadingEl); }
    if (!estudiantes.length) { if (loadingEl) loadingEl.style.display = 'none'; grid.innerHTML += '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No hay estudiantes registrados aún.</p>'; return; }

    const existing = grid.querySelectorAll('.estudiante-card');
    existing.forEach(el => el.remove());

    estudiantes.forEach(est => {
        const card = document.createElement('div');
        card.classList.add('estudiante-card');
        card.setAttribute('data-id', est.id);
        const fotoUrl = est.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(est.nombre_completo || '?')}&background=3b82f6&color=fff&size=200`;
        card.innerHTML = `
            <div class="estudiante-foto-wrap">
                <img src="${fotoUrl}" alt="${est.nombre_completo}" class="estudiante-foto" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(est.nombre_completo||'?')}&background=3b82f6&color=fff&size=200'">
            </div>
            <div class="estudiante-info">
                <h3 class="estudiante-nombre">${est.nombre_completo || '—'}</h3>
                <span class="estudiante-especialidad">${est.especialidad || ''}</span>
                ${est.ciclo ? `<span class="estudiante-ciclo">Ciclo ${est.ciclo}</span>` : ''}
            </div>`;
        grid.appendChild(card);
    });
}

let realtimeChannel = null;

function inicializarRealtimeEstudiantes() {
    if (!supabaseClient || realtimeChannel) return;
    try {
        realtimeChannel = supabaseClient
            .channel('estudiantes-changes')
            .on('postgres_changes', { event:'INSERT', schema:'public', table:'estudiantes' }, (payload) => {
                const grid = document.getElementById('estudiantes-grid');
                if (!grid || currentTab !== 'estudiantes') return;
                const est     = payload.new;
                const fotoUrl = est.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(est.nombre_completo||'?')}&background=3b82f6&color=fff&size=200`;
                const card    = document.createElement('div');
                card.classList.add('estudiante-card');
                card.setAttribute('data-id', est.id);
                card.innerHTML = `
                    <div class="estudiante-foto-wrap"><img src="${fotoUrl}" alt="${est.nombre_completo}" class="estudiante-foto"></div>
                    <div class="estudiante-info">
                        <h3 class="estudiante-nombre">${est.nombre_completo || '—'}</h3>
                        <span class="estudiante-especialidad">${est.especialidad || ''}</span>
                        ${est.ciclo ? `<span class="estudiante-ciclo">Ciclo ${est.ciclo}</span>` : ''}
                    </div>`;
                const firstCard = grid.querySelector('.estudiante-card');
                if (firstCard) grid.insertBefore(card, firstCard);
                else grid.appendChild(card);
            })
            .subscribe();
    } catch(e) { console.error('Realtime estudiantes error:', e); }
}