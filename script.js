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

// ============================================
// ESTADO UI
// ============================================
function showConnectionLoader() {
    const el = document.getElementById('connectionLoader');
    if (el) el.style.display = 'flex';
}

function hideConnectionLoader() {
    const el = document.getElementById('connectionLoader');
    if (el) el.style.display = 'none';
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
// HELPERS DE PASOS — OCULTAR TODOS LOS STEPS
// ============================================
function _ocultarTodosLosSteps() {
    const ids = [
        'auth-step-code',
        'auth-step-registro',
        'auth-step-google',
        'auth-step-api-reveal',
        'auth-step-laptop',
        'auth-step-google-laptop'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// ============================================
// ══ FLUJO MÓVIL: PASO 1 — Nombre + Código ══
// ============================================
function mostrarPaso1() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-code').style.display = 'block';

    const errCode = document.getElementById('authError');
    if (errCode) { errCode.style.display = 'none'; errCode.textContent = ''; }

    const btn = document.getElementById('authSubmit');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

// ============================================
// ══ FLUJO MÓVIL: PASO 2 — Perfil (esp+ciclo+foto) ══
// ============================================
function mostrarPasoRegistro() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-registro').style.display = 'block';

    const errReg = document.getElementById('authRegistroError');
    if (errReg) { errReg.textContent = ''; errReg.style.display = 'none'; }

    // Reset campos
    const esp  = document.getElementById('selectEspecialidad');
    const ciclo = document.getElementById('selectCiclo');
    if (esp) esp.value   = '';
    if (ciclo) ciclo.value = '';

    resetImagePreview();
    selectedImageFile    = null;
    selectedImageDataUrl = '';
    selectedEspecialidad = '';
    selectedCiclo        = '';
}

// ============================================
// ══ FLUJO MÓVIL: PASO 3 — Google Sign-in ══
// ============================================
function mostrarPaso2Google() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-google').style.display = 'block';

    const errGoogle = document.getElementById('googleError');
    if (errGoogle) { errGoogle.style.display = 'none'; errGoogle.textContent = ''; }

    const btn = document.getElementById('googleSignInBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = googleBtnHTML();
    }

    const tempVal = _getTempValidacion();
    if (tempVal) {
        const infoEl = document.getElementById('auth-codigo-validado');
        if (infoEl) {
            infoEl.textContent = `✅ Código "${tempVal.codigo}" verificado. Ahora vincula tu cuenta de Google.`;
        }
    }
}

// ============================================
// ══ FLUJO MÓVIL: PASO 4 — Revelar API ══
// (Solo aparece en móvil, después del Google auth)
// ============================================
function mostrarPasoApiReveal(nombre, api) {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-api-reveal').style.display = 'block';

    const saludoEl = document.getElementById('apiRevealSaludo');
    const numEl    = document.getElementById('apiRevealNumber');

    if (saludoEl) saludoEl.textContent = `Hola, ${nombre} 👋`;
    if (numEl)    numEl.textContent    = String(api);
}

// Al presionar "Entendido" en la pantalla de API
function finalizarRegistroMobile() {
    hideAuthModal();
    actualizarPerfilSidebar();
}

// ============================================
// ══ FLUJO LAPTOP: PASO 1 — Ingresar API ══
// (Solo aparece en desktop)
// ============================================
function mostrarPasoLaptop() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-laptop').style.display = 'block';

    const errEl = document.getElementById('laptopApiError');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    const btn = document.getElementById('laptopApiSubmit');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }

    // Limpiar input
    const input = document.getElementById('laptopApiInput');
    if (input) input.value = '';
}

// ============================================
// ══ FLUJO LAPTOP: VALIDAR API ══
// ============================================
async function validarAPI() {
    const apiInput = document.getElementById('laptopApiInput').value.trim();
    const errEl    = document.getElementById('laptopApiError');
    const btn      = document.getElementById('laptopApiSubmit');

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    if (!apiInput) {
        if (errEl) { errEl.textContent = '⚠️ Por favor ingresa tu API numérica.'; errEl.style.display = 'block'; }
        return;
    }

    // Solo dígitos
    if (!/^\d+$/.test(apiInput)) {
        if (errEl) { errEl.textContent = '⚠️ El API debe ser un número (solo dígitos).'; errEl.style.display = 'block'; }
        return;
    }

    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

    try {
        // Buscar el código que tenga este API en Firebase
        const snapshot = await database.ref('codigos').once('value');
        const codigos  = snapshot.val();

        if (!codigos) {
            if (errEl) { errEl.textContent = '❌ API no encontrada. Verifica el número.'; errEl.style.display = 'block'; }
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        let codigoEncontrado = null;
        let codigoKey        = null;

        for (const [key, data] of Object.entries(codigos)) {
            if (data.api && String(data.api) === String(apiInput)) {
                codigoEncontrado = data;
                codigoKey        = key;
                break;
            }
        }

        if (!codigoEncontrado) {
            if (errEl) { errEl.textContent = '❌ API no encontrada. Verifica el número.'; errEl.style.display = 'block'; }
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        // Verificar bloqueo
        if (codigoEncontrado.bloqueado === true) {
            const motivo = codigoEncontrado.motivoBloqueo || 'Tu acceso ha sido bloqueado.';
            if (errEl) { errEl.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`; errEl.style.display = 'block'; }
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        // SEGURIDAD: El móvil debe haberse registrado primero
        const dispositivos  = codigoEncontrado.dispositivos || {};
        const mobileDevice  = Object.values(dispositivos).find(d => d.tipo === 'mobile');

        if (!mobileDevice) {
            if (errEl) {
                errEl.textContent = '📱 Primero debes registrarte desde tu dispositivo móvil con este código.';
                errEl.style.display = 'block';
            }
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        // Verificar que el API pertenece a un código real (API no vacía en panel)
        if (!codigoEncontrado.api) {
            if (errEl) {
                errEl.textContent = '❌ Este código no tiene API asignada. Contacta al administrador.';
                errEl.style.display = 'block';
            }
            btn.disabled  = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        const userName = codigoEncontrado.perfil?.nombre || mobileDevice.usuario || '';

        // Guardar temp: incluye el googleUid del móvil (REQUERIDO para verificar)
        _setTempValidacion({
            api:               apiInput,
            codigo:            codigoKey,
            codigoData:        codigoEncontrado,
            userName:          userName,
            requiredGoogleUid: mobileDevice.googleUid   // SEGURIDAD: la cuenta Google debe coincidir
        });

        btn.disabled  = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';

        mostrarPasoGoogleLaptop();

    } catch (error) {
        console.error('Error validando API:', error);
        if (errEl) { errEl.textContent = '❌ Error de conexión. Intenta nuevamente.'; errEl.style.display = 'block'; }
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

// ============================================
// ══ FLUJO LAPTOP: PASO 2 — Google Sign-in ══
// ============================================
function mostrarPasoGoogleLaptop() {
    _ocultarTodosLosSteps();
    document.getElementById('auth-step-google-laptop').style.display = 'block';

    const tempVal = _getTempValidacion();
    const infoEl  = document.getElementById('auth-api-validado');
    if (infoEl && tempVal) {
        infoEl.textContent = `✅ API verificada · Bienvenido, ${tempVal.userName}.`;
    }

    const errEl = document.getElementById('googleErrorLaptop');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    const btn = document.getElementById('googleSignInBtnLaptop');
    if (btn) {
        btn.disabled  = false;
        btn.innerHTML = googleBtnHTML();
    }
}

// ============================================
// ══ FLUJO LAPTOP: Google Sign-in ══
// ============================================
async function signInWithGoogleLaptop() {
    const btn   = document.getElementById('googleSignInBtnLaptop');
    const errEl = document.getElementById('googleErrorLaptop');

    if (!_getTempValidacion()) {
        if (errEl) { errEl.textContent = '⚠️ Error interno. Recarga e intenta de nuevo.'; errEl.style.display = 'block'; }
        return;
    }

    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
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
        btn.disabled  = false;
        btn.innerHTML = googleBtnHTML();
    } finally {
        _registrandoAhora = false;
    }
}

// ============================================
// ══ FLUJO LAPTOP: COMPLETAR REGISTRO ══
// ============================================
async function completarRegistroLaptop(user) {
    const tempVal = _getTempValidacion();

    if (!tempVal) {
        console.warn('completarRegistroLaptop sin datos temp.');
        await auth.signOut().catch(console.error);
        showAuthModal();
        mostrarPasoLaptop();
        return;
    }

    const { codigo, codigoData, userName, requiredGoogleUid } = tempVal;
    const googleUid = user.uid;
    const deviceKey = `${googleUid}_desktop`;

    const errEl = document.getElementById('googleErrorLaptop');
    const btn   = document.getElementById('googleSignInBtnLaptop');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...'; }
    if (errEl) errEl.style.display = 'none';

    try {
        // Releer datos frescos de Firebase
        const snapshot  = await database.ref(`codigos/${codigo}`).once('value');
        const freshData = snapshot.val();

        if (!freshData) {
            await _cerrarSesionLaptopYMostrarError('❌ El código ya no existe en el sistema.', errEl, btn);
            return;
        }

        if (freshData.bloqueado === true) {
            const motivo = freshData.motivoBloqueo || 'Acceso bloqueado.';
            await _cerrarSesionLaptopYMostrarError(`🚫 ACCESO BLOQUEADO: ${motivo}`, errEl, btn);
            return;
        }

        // ── SEGURIDAD CRÍTICA: La cuenta Google DEBE coincidir con la del móvil ──
        if (googleUid !== requiredGoogleUid) {
            await _cerrarSesionLaptopYMostrarError(
                '🚫 La cuenta de Google ingresada no pertenece al propietario de este API. ' +
                'Debes usar la misma cuenta de Google con la que te registraste en el móvil.',
                errEl, btn
            );
            return;
        }

        const dispositivos = freshData.dispositivos || {};

        // Si el dispositivo desktop ya existe para este UID: actualizar acceso
        if (dispositivos[deviceKey]) {
            await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`)
                .set(new Date().toISOString());

            await _cargarPerfilDesdeFirebase(freshData, userName);
            _guardarSesionLocal(userName, codigo, googleUid, 'desktop');
            _setTempValidacion(null);
            hideAuthModal();
            if (codigo === '6578hy') showSpecialUserMessage();
            iniciarListenerBloqueo();
            actualizarPerfilSidebar();
            return;
        }

        // Verificar límite de 1 desktop por código
        const desktopCount = Object.values(dispositivos).filter(d => d.tipo === 'desktop').length;
        if (desktopCount >= 1) {
            await _cerrarSesionLaptopYMostrarError(
                '💻 Este código ya tiene una laptop registrada. Solo se permite 1 laptop por código.',
                errEl, btn
            );
            return;
        }

        // Registrar dispositivo desktop en Firebase
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${deviceKey}`] = {
            googleUid:     googleUid,
            googleEmail:   user.email,
            tipo:          'desktop',
            usuario:       userName,
            fechaRegistro: new Date().toISOString(),
            ultimoAcceso:  new Date().toISOString()
        };
        await database.ref().update(updates);

        // Cargar perfil desde Firebase → localStorage
        await _cargarPerfilDesdeFirebase(freshData, userName);

        _guardarSesionLocal(userName, codigo, googleUid, 'desktop');
        _setTempValidacion(null);
        hideAuthModal();
        if (codigo === '6578hy') showSpecialUserMessage();
        iniciarListenerBloqueo();
        actualizarPerfilSidebar();

    } catch (error) {
        console.error('Error en completarRegistroLaptop:', error);
        if (btn) { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
        if (errEl) { errEl.textContent = '❌ Error de conexión. Intenta nuevamente.'; errEl.style.display = 'block'; }
    } finally {
        _registrandoAhora = false;
    }
}

// Cierra sesión y muestra error en el contexto laptop
async function _cerrarSesionLaptopYMostrarError(mensaje, errEl, btn) {
    const userActual = auth.currentUser;
    if (userActual) {
        try { await userActual.delete(); }
        catch(e) { await auth.signOut().catch(console.error); }
    }
    _setTempValidacion(null);
    if (errEl) { errEl.innerHTML = mensaje; errEl.style.display = 'block'; }
    if (btn)   { btn.disabled = false; btn.innerHTML = googleBtnHTML(); }
}

// Carga el perfil desde Firebase y lo guarda en localStorage
async function _cargarPerfilDesdeFirebase(codigoData, userName) {
    const perfil = codigoData.perfil;

    let profileData;
    if (perfil && perfil.foto_url) {
        profileData = {
            nombre:              perfil.nombre        || userName,
            especialidad:        perfil.especialidad  || '',
            ciclo:               perfil.ciclo         || '',
            foto_url:            perfil.foto_url,
            supabase_registered: false
        };
    } else {
        profileData = {
            nombre:              userName,
            especialidad:        '',
            ciclo:               '',
            foto_url:            '',
            supabase_registered: false
        };
    }

    localStorage.setItem('eduspace_student_profile', JSON.stringify(profileData));
}

// Guarda el perfil del estudiante en Firebase para que la laptop pueda accederlo
async function _savePerfilToFirebase(codigo, perfil) {
    if (!codigo) return;
    try {
        await database.ref(`codigos/${codigo}/perfil`).set({
            nombre:       perfil.nombre       || '',
            especialidad: perfil.especialidad || '',
            ciclo:        perfil.ciclo        || '',
            foto_url:     perfil.foto_url     || ''
        });
    } catch(e) {
        console.error('Error guardando perfil en Firebase:', e);
    }
}

// ============================================
// HTML del botón de Google (reutilizable)
// ============================================
function googleBtnHTML() {
    return `
        <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Continuar con Google
    `;
}

// ============================================
// ══ FLUJO MÓVIL: CONTINUAR DESDE AUTH ══
// (Valida esp+ciclo+foto y avanza a Google)
// ============================================
function continuarDesdeAuth() {
    const esp   = document.getElementById('selectEspecialidad').value;
    const ciclo = document.getElementById('selectCiclo').value;
    const errEl = document.getElementById('authRegistroError');

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    if (!esp || !ciclo) {
        if (errEl) { errEl.textContent = '⚠️ Por favor selecciona tu especialidad y ciclo.'; errEl.style.display = 'block'; }
        return;
    }

    if (!selectedImageFile) {
        if (errEl) { errEl.textContent = '⚠️ Por favor selecciona una foto de perfil para continuar.'; errEl.style.display = 'block'; }
        return;
    }

    selectedEspecialidad = esp;
    selectedCiclo        = ciclo;

    mostrarPaso2Google();
}

// ============================================
// FLUJO MÓVIL: VALIDAR NOMBRE + CÓDIGO
// ============================================
function normalizarNombre(nombre) {
    return nombre.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

async function validarCodigo() {
    const userName  = document.getElementById('authUserName').value.trim();
    const codigo    = document.getElementById('authCode').value.trim();
    const errorDiv  = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    errorDiv.style.display = 'none';
    errorDiv.textContent   = '';

    if (!userName) { errorDiv.textContent = 'Por favor, ingresa tu nombre.'; errorDiv.style.display = 'block'; return; }
    if (!codigo)   { errorDiv.textContent = 'Por favor, ingresa tu código.'; errorDiv.style.display = 'block'; return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

    try {
        let snapshot;
        try {
            snapshot = await database.ref(`codigos/${codigo}`).once('value');
        } catch(fbError) {
            errorDiv.textContent = '⚠️ Error de conexión. Verifica tu internet e intenta nuevamente.';
            errorDiv.style.display = 'block';
            submitBtn.disabled  = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        if (!snapshot.exists()) {
            errorDiv.textContent = '❌ Código inválido. Verifica con el administrador.';
            errorDiv.style.display = 'block';
            submitBtn.disabled  = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        const codigoData           = snapshot.val();
        const dispositivosActuales = codigoData.dispositivos || {};
        const dispositivosKeys     = Object.keys(dispositivosActuales);

        if (codigoData.bloqueado === true) {
            const motivo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`;
            errorDiv.style.display = 'block';
            submitBtn.disabled  = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        // Verificar nombre (Capa A: propietario explícito)
        if (codigoData.propietario && codigoData.propietario.trim() !== '') {
            const propNorm = normalizarNombre(codigoData.propietario);
            const userNorm = normalizarNombre(userName);
            if (propNorm !== userNorm) {
                errorDiv.innerHTML = `❌ El nombre ingresado no coincide con el registrado para este código.<br>
                    <small style="opacity:.8;">Escríbelo exactamente como el administrador lo registró.</small>`;
                errorDiv.style.display = 'block';
                submitBtn.disabled  = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
                return;
            }
        }
        // Capa B: candado automático
        else if (dispositivosKeys.length > 0) {
            let nombrePrimero = '';
            for (const key of dispositivosKeys) {
                const u = (dispositivosActuales[key].usuario || '').trim();
                if (u) { nombrePrimero = u; break; }
            }
            if (nombrePrimero) {
                const primNorm = normalizarNombre(nombrePrimero);
                const userNorm = normalizarNombre(userName);
                if (primNorm !== userNorm) {
                    errorDiv.innerHTML = `❌ El nombre ingresado no coincide con el titular de este código.<br>
                        <small style="opacity:.8;">Este código ya está vinculado a otro usuario.</small>`;
                    errorDiv.style.display = 'block';
                    submitBtn.disabled  = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
                    return;
                }
            }
        }

        _setTempValidacion({ userName, codigo, codigoData });

        submitBtn.disabled  = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';

        const user            = auth.currentUser;
        const perfilExistente = localStorage.getItem('eduspace_student_profile');

        if (user) {
            perfilExistente ? await completarRegistro(user) : mostrarPasoRegistro();
        } else {
            perfilExistente ? mostrarPaso2Google() : mostrarPasoRegistro();
        }

    } catch (error) {
        console.error('Error en validarCodigo:', error);
        errorDiv.textContent = '❌ Error de conexión. Por favor, intenta nuevamente.';
        errorDiv.style.display = 'block';
        submitBtn.disabled  = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

// ============================================
// FLUJO MÓVIL: GOOGLE SIGN-IN
// ============================================
async function signInWithGoogle() {
    const btn      = document.getElementById('googleSignInBtn');
    const errorDiv = document.getElementById('googleError');

    if (!_getTempValidacion()) {
        errorDiv.textContent = '⚠️ Error interno. Recarga la página e intenta de nuevo.';
        errorDiv.style.display = 'block';
        return;
    }

    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
    errorDiv.style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        _registrandoAhora = true;
        const result = await auth.signInWithPopup(provider);
        await completarRegistro(result.user);
    } catch (error) {
        console.error('Error Google Sign-In:', error);
        let mensaje = '❌ Error al iniciar sesión con Google. Intenta nuevamente.';
        if (error.code === 'auth/popup-closed-by-user') mensaje = '⚠️ Cerraste la ventana de Google. Intenta nuevamente.';
        if (error.code === 'auth/popup-blocked')         mensaje = '⚠️ El navegador bloqueó la ventana emergente. Permite las ventanas emergentes.';
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
        btn.disabled  = false;
        btn.innerHTML = googleBtnHTML();
    } finally {
        _registrandoAhora = false;
    }
}

// ============================================
// FLUJO MÓVIL: COMPLETAR REGISTRO EN FIREBASE
// + Guarda perfil en Firebase + Muestra API
// ============================================
async function completarRegistro(user) {
    if (!_getTempValidacion()) {
        console.warn('completarRegistro sin _tempValidacion.');
        await auth.signOut();
        showAuthModal();
        mostrarPaso1();
        return;
    }

    const { userName, codigo } = _getTempValidacion();
    const googleUid  = user.uid;
    const deviceType = 'mobile'; // Esta función solo se llama desde el flujo móvil
    const deviceKey  = `${googleUid}_${deviceType}`;

    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) { googleBtn.disabled = true; googleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...'; }

    const googleErr = document.getElementById('googleError');
    if (googleErr) googleErr.style.display = 'none';

    try {
        const snapshot   = await database.ref(`codigos/${codigo}`).once('value');
        const codigoData = snapshot.val();

        if (!codigoData) { await _cerrarSesionYMostrarError('❌ El código ya no existe en el sistema.'); return; }
        if (codigoData.bloqueado === true) {
            const motivo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado.';
            await _cerrarSesionYMostrarError(`🚫 ACCESO BLOQUEADO: ${motivo}`);
            return;
        }

        const dispositivosActuales = codigoData.dispositivos || {};
        const dispositivosKeys     = Object.keys(dispositivosActuales);

        // Si este dispositivo móvil ya existe: solo actualizar acceso
        if (dispositivosActuales[deviceKey]) {
            const updates = {};
            updates[`codigos/${codigo}/dispositivos/${deviceKey}/usuario`]      = userName;
            updates[`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`] = new Date().toISOString();
            await database.ref().update(updates);

            _guardarSesionLocal(userName, codigo, googleUid, deviceType);
            _setTempValidacion(null);

            await _guardarPerfilEstudianteDesdAuth(userName, codigo, codigoData);

            if (codigo === '6578hy') showSpecialUserMessage();
            iniciarListenerBloqueo();

            // Mostrar API al usuario
            const apiNum = codigoData.api;
            if (apiNum) {
                mostrarPasoApiReveal(userName, apiNum);
            } else {
                hideAuthModal();
                actualizarPerfilSidebar();
            }
            return;
        }

        // Verificar que no haya otra cuenta Google ya registrada
        if (dispositivosKeys.length > 0) {
            const otraCuenta = Object.values(dispositivosActuales).find(
                dev => dev.googleUid && dev.googleUid !== googleUid
            );
            if (otraCuenta) {
                await _cerrarSesionYMostrarError(
                    '🚫 Este código ya está vinculado a otra cuenta de Google. Usa la misma cuenta original.'
                );
                return;
            }
        }

        // Verificar límite de dispositivos (1 móvil por código)
        const mobileCount = Object.values(dispositivosActuales).filter(d => d.tipo === 'mobile').length;
        if (mobileCount >= 1) {
            await _cerrarSesionYMostrarError(
                '📱 Este código ya está en uso en 1 dispositivo móvil. Solo se permite 1 móvil por código.'
            );
            return;
        }

        const totalDispositivos = dispositivosKeys.length;
        if (totalDispositivos >= 2) {
            await _cerrarSesionYMostrarError(
                '⚠️ Este código ya alcanzó el límite de 2 dispositivos (1 móvil + 1 PC).'
            );
            return;
        }

        // Escribir en Firebase
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${deviceKey}`] = {
            googleUid:     googleUid,
            googleEmail:   user.email,
            tipo:          deviceType,
            usuario:       userName,
            fechaRegistro: new Date().toISOString(),
            ultimoAcceso:  new Date().toISOString()
        };

        const usosRestantes = Math.max(0, 2 - (totalDispositivos + 1));
        updates[`codigos/${codigo}/usosRestantes`] = usosRestantes;
        if (usosRestantes === 0) updates[`codigos/${codigo}/completado`] = true;

        await database.ref().update(updates);

        _guardarSesionLocal(userName, codigo, googleUid, deviceType);
        _setTempValidacion(null);

        // ── Guardar perfil del estudiante en Firebase (para laptop) ──
        await _guardarPerfilEstudianteDesdAuth(userName, codigo, codigoData);

        if (codigo === '6578hy') showSpecialUserMessage();
        iniciarListenerBloqueo();

        // ── MOSTRAR API AL USUARIO MÓVIL ──
        const apiNum = codigoData.api;
        if (apiNum) {
            mostrarPasoApiReveal(userName, apiNum);
        } else {
            hideAuthModal();
            actualizarPerfilSidebar();
        }

    } catch (error) {
        console.error('Error en completarRegistro:', error);
        if (googleBtn) { googleBtn.disabled = false; googleBtn.innerHTML = googleBtnHTML(); }
        if (googleErr)  { googleErr.textContent = '❌ Error de conexión. Por favor, intenta nuevamente.'; googleErr.style.display = 'block'; }
    } finally {
        _registrandoAhora = false;
    }
}

// ============================================
// GUARDAR PERFIL DESDE AUTH MÓVIL
// Sube foto a Cloudinary + guarda en localStorage + guarda en Firebase
// ============================================
async function _guardarPerfilEstudianteDesdAuth(userName, codigo, codigoData) {
    const perfilExistente = localStorage.getItem('eduspace_student_profile');

    // Si el perfil ya existe en Firebase, solo actualizar el sidebar
    if (perfilExistente) {
        // Intentar sincronizar con Firebase si no tiene foto aún
        const perfilData = JSON.parse(perfilExistente);
        if (perfilData.foto_url && codigo) {
            await _savePerfilToFirebase(codigo, perfilData);
        }
        actualizarPerfilSidebar();
        return;
    }

    if (!selectedImageFile && !selectedImageDataUrl) {
        actualizarPerfilSidebar();
        return;
    }

    try {
        let fotoUrl = selectedImageDataUrl; // fallback

        if (selectedImageFile) {
            const formData = new FormData();
            formData.append('file', selectedImageFile);
            formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
            formData.append('folder', 'estudiantes_clouddesk');

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`,
                { method: 'POST', body: formData }
            );
            if (res.ok) {
                const data = await res.json();
                fotoUrl = data.secure_url;
            } else {
                console.warn('Cloudinary upload falló, usando dataURL como fallback.');
            }
        }

        const perfil = {
            nombre:              userName,
            especialidad:        selectedEspecialidad,
            ciclo:               selectedCiclo,
            foto_url:            fotoUrl,
            supabase_registered: false
        };

        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));

        // Guardar en Firebase para que la laptop lo pueda leer
        if (codigo) await _savePerfilToFirebase(codigo, perfil);

        actualizarPerfilSidebar();

    } catch (err) {
        console.error('Error en _guardarPerfilEstudianteDesdAuth:', err);
        if (selectedImageDataUrl) {
            const perfilFallback = {
                nombre:              userName,
                especialidad:        selectedEspecialidad,
                ciclo:               selectedCiclo,
                foto_url:            selectedImageDataUrl,
                supabase_registered: false
            };
            localStorage.setItem('eduspace_student_profile', JSON.stringify(perfilFallback));
            if (codigo) await _savePerfilToFirebase(codigo, perfilFallback).catch(console.error);
            actualizarPerfilSidebar();
        }
    }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function _guardarSesionLocal(userName, codigo, googleUid, deviceType) {
    localStorage.setItem('eduspace_auth', JSON.stringify({
        userName, codigo, googleUid, deviceType, timestamp: Date.now()
    }));
}

async function _cerrarSesionYMostrarError(mensaje) {
    const userAEliminar = auth.currentUser;
    if (userAEliminar) {
        try { await userAEliminar.delete(); }
        catch(deleteErr) { await auth.signOut().catch(e => console.error(e)); }
    }
    localStorage.removeItem('eduspace_auth');
    _setTempValidacion(null);
    showAuthModal();
    mostrarPaso1();
    const errDiv = document.getElementById('authError');
    if (errDiv) { errDiv.innerHTML = mensaje; errDiv.style.display = 'block'; }
}

async function validateAuthWithFirebase(googleUid) {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return false;

    try {
        const parsed             = JSON.parse(authData);
        const { codigo, userName } = parsed;

        if (parsed.googleUid !== googleUid) {
            localStorage.removeItem('eduspace_auth');
            return false;
        }

        const codigoRef  = database.ref(`codigos/${codigo}`);
        const snapshot   = await codigoRef.once('value');
        const codigoData = snapshot.val();

        if (!codigoData) { localStorage.removeItem('eduspace_auth'); showAuthError('Código inválido o eliminado del sistema.'); return false; }
        if (codigoData.bloqueado === true) {
            localStorage.removeItem('eduspace_auth');
            const motivoBloqueo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            showAuthError(`🚫 ACCESO BLOQUEADO: ${motivoBloqueo}`);
            return false;
        }

        // Verificar nombre
        if (codigoData.propietario && codigoData.propietario.trim() !== '') {
            const propNorm = normalizarNombre(codigoData.propietario);
            const userNorm = normalizarNombre(userName || '');
            if (propNorm !== userNorm) {
                localStorage.removeItem('eduspace_auth');
                showAuthError('⚠️ La sesión guardada no es válida. Ingresa de nuevo.');
                return false;
            }
        } else {
            const dispositivos = codigoData.dispositivos || {};
            let nombrePrimero  = '';
            for (const key of Object.keys(dispositivos)) {
                const u = (dispositivos[key].usuario || '').trim();
                if (u) { nombrePrimero = u; break; }
            }
            if (nombrePrimero) {
                const primNorm = normalizarNombre(nombrePrimero);
                const userNorm = normalizarNombre(userName || '');
                if (primNorm !== userNorm) {
                    localStorage.removeItem('eduspace_auth');
                    showAuthError('⚠️ La sesión guardada no corresponde al titular de este código.');
                    return false;
                }
            }
        }

        const dispositivos = codigoData.dispositivos || {};
        const deviceType   = parsed.deviceType || getDeviceType();
        const deviceKey    = `${googleUid}_${deviceType}`;

        if (!dispositivos[deviceKey]) {
            localStorage.removeItem('eduspace_auth');
            showAuthError('Sesión inválida. Este dispositivo no está autorizado para este código.');
            return false;
        }

        // Actualizar último acceso
        await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`)
            .set(new Date().toISOString());

        // Si es laptop y no tiene perfil local, intentar cargarlo desde Firebase
        if (deviceType === 'desktop') {
            const perfilLocal = localStorage.getItem('eduspace_student_profile');
            if (!perfilLocal && codigoData.perfil && codigoData.perfil.foto_url) {
                await _cargarPerfilDesdeFirebase(codigoData, userName);
            }
        }

        if (codigo === '6578hy') showSpecialUserMessage();

        return true;

    } catch(e) {
        console.error('Error validando autenticación:', e);
        localStorage.removeItem('eduspace_auth');
        return false;
    }
}

function contarDispositivosPorTipo(dispositivos) {
    let mobileCount = 0, desktopCount = 0;
    Object.values(dispositivos).forEach(device => {
        if (device.tipo === 'mobile')  mobileCount++;
        if (device.tipo === 'desktop') desktopCount++;
    });
    return { mobile: mobileCount, desktop: desktopCount };
}

function showAuthError(message) {
    const errCode   = document.getElementById('authError');
    const errGoogle = document.getElementById('googleError');
    const stepCode  = document.getElementById('auth-step-code');
    if (stepCode && stepCode.style.display !== 'none') {
        if (errCode) { errCode.innerHTML = message; errCode.style.display = 'block'; }
    } else {
        if (errGoogle) { errGoogle.innerHTML = message; errGoogle.style.display = 'block'; }
    }
}

function showSpecialUserMessage() {
    const el = document.getElementById('specialUserMessage');
    if (el) el.style.display = 'flex';
}

function hideSpecialUserMessage() {
    const el = document.getElementById('specialUserMessage');
    if (el) el.style.display = 'none';
}

async function cerrarSesionYReingresar() {
    closeRegistroModal();
    await auth.signOut().catch(console.error);
    localStorage.removeItem('eduspace_auth');
    localStorage.removeItem('eduspace_student_profile');
    _setTempValidacion(null);
    showAuthModal();
    const isMobile = getDeviceType() === 'mobile';
    isMobile ? mostrarPaso1() : mostrarPasoLaptop();
}

// ============================================
// INICIALIZACIÓN
// ============================================
let _appInicializada = false;

document.addEventListener('DOMContentLoaded', async () => {
    showConnectionLoader();

    const isMobile = getDeviceType() === 'mobile';

    // Eventos del flujo móvil (solo si es móvil)
    if (isMobile) {
        const submitBtn = document.getElementById('authSubmit');
        if (submitBtn) submitBtn.addEventListener('click', validarCodigo);

        document.getElementById('authUserName')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') validarCodigo(); });
        document.getElementById('authCode')?.addEventListener('keypress',     (e) => { if (e.key === 'Enter') validarCodigo(); });
    }

    // Evento del flujo laptop (solo si es desktop)
    if (!isMobile) {
        document.getElementById('laptopApiInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') validarAPI(); });
    }

    auth.onAuthStateChanged(async (user) => {
    hideConnectionLoader();

    if (user) {
        const authData = localStorage.getItem('eduspace_auth');

        if (authData) {
            const ok = await validateAuthWithFirebase(user.uid);
            if (ok) {
                const apiRevealStep = document.getElementById('auth-step-api-reveal');
                const apiRevealVisible = apiRevealStep && apiRevealStep.style.display !== 'none';
                if (!apiRevealVisible) {
                    hideAuthModal();
                }
                iniciarListenerBloqueo();
                actualizarPerfilSidebar();
            } else {
                showAuthModal();
                isMobile ? mostrarPaso1() : mostrarPasoLaptop();
            }
        } else {
            if (_registrandoAhora) return;
            try { await user.delete(); }
            catch(e) { await auth.signOut().catch(console.error); }
            showAuthModal();
            isMobile ? mostrarPaso1() : mostrarPasoLaptop();
        }
    } else {
        showAuthModal();
        isMobile ? mostrarPaso1() : mostrarPasoLaptop();
    }

    if (!_appInicializada) {
        _appInicializada = true;
        updatePendingBadge();
        actualizarPerfilSidebar();
        switchTab('repositorio');
    }
});

    // Listener del checkbox de términos (en registro modal)
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
        const parsed     = JSON.parse(authData);
        const { codigo } = parsed;

        if (bloqueoListener) {
            database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener);
        }

        bloqueoListener = database.ref(`codigos/${codigo}/bloqueado`).on('value', (snapshot) => {
            const estaBloqueado = snapshot.val();

            if (estaBloqueado === true) {
                database.ref(`codigos/${codigo}/motivoBloqueo`).once('value', async (motivoSnapshot) => {
                    const motivo = motivoSnapshot.val() || 'Tu acceso ha sido bloqueado por el administrador.';
                    await auth.signOut().catch(e => console.error(e));
                    localStorage.removeItem('eduspace_auth');
                    _setTempValidacion(null);

                    showAuthModal();
                    const isMobile = getDeviceType() === 'mobile';
                    isMobile ? mostrarPaso1() : mostrarPasoLaptop();

                    const errorDiv = document.getElementById(isMobile ? 'authError' : 'laptopApiError');
                    if (errorDiv) {
                        errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`;
                        errorDiv.style.display = 'block';
                    }

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

function mostrarNotificacionDesbloqueo() {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position:fixed;top:20px;right:20px;
        background:linear-gradient(135deg,#10b981,#0d9668);
        color:white;padding:1rem 1.5rem;border-radius:12px;
        box-shadow:0 4px 15px rgba(16,185,129,0.4);
        display:flex;align-items:center;gap:10px;
        font-weight:600;z-index:9999;
        animation:slideInRight 0.5s ease;
    `;
    notif.innerHTML = `<i class="fa-solid fa-check-circle" style="font-size:1.5rem;"></i><span>Tu acceso ha sido restaurado</span>`;
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.animation = 'slideOutRight 0.5s ease'; setTimeout(() => notif.remove(), 500); }, 5000);
}

window.addEventListener('beforeunload', () => {
    const authData = localStorage.getItem('eduspace_auth');
    if (authData && bloqueoListener) {
        try {
            const parsed = JSON.parse(authData);
            database.ref(`codigos/${parsed.codigo}/bloqueado`).off('value', bloqueoListener);
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
    {
        id:101, task:"Informe de Laboratorio #3", teacher:"Dra. María González", deadline:"2025-05-25", status:"Pendiente",
        description:"Realizar un informe completo sobre el experimento de fotosíntesis realizado en clase. El informe debe incluir introducción, metodología, resultados, análisis y conclusiones.",
        requirements:["Mínimo 5 páginas, máximo 8 páginas","Incluir gráficos y tablas de los datos obtenidos","Referencias bibliográficas en formato APA","Análisis crítico de los resultados","Conclusiones basadas en evidencia científica"],
        attachments:[{ name:"Guía del Informe.pdf", size:"245 KB", type:"PDF", downloadUrl:"enlace de google drive" },{ name:"Datos del Experimento.xlsx", size:"128 KB", type:"Excel", downloadUrl:"enlace desde google drive" }]
    },
    {
        id:102, task:"Análisis de 'Cien Años de Soledad'", teacher:"Lic. Carlos Fuentes", deadline:"2025-05-20", status:"Pendiente",
        description:"Realizar un análisis literario profundo de la obra 'Cien Años de Soledad' de Gabriel García Márquez.",
        requirements:["Ensayo de 6-8 páginas","Análisis de al menos 3 personajes principales","Identificación de elementos del realismo mágico","Contexto histórico y social de la obra","Citas textuales debidamente referenciadas"],
        attachments:[{ name:"Rúbrica de Evaluación.pdf", size:"156 KB", type:"PDF", downloadUrl:"enlace de google drive" },{ name:"Ejemplos de Análisis.docx", size:"89 KB", type:"Word", downloadUrl:"enlace desde github" }]
    },
    {
        id:103, task:"Línea de tiempo S.XIX", teacher:"Prof. Diana Prince", deadline:"2025-05-10", status:"Pendiente",
        description:"Crear una línea de tiempo interactiva que muestre los eventos más importantes del siglo XIX a nivel mundial.",
        requirements:["Mínimo 20 eventos históricos relevantes","Incluir imágenes representativas de cada evento","Descripción de 50-100 palabras por evento","Formato digital (PowerPoint, Prezi o similar)","Presentación visual atractiva y organizada"],
        attachments:[{ name:"Plantilla Línea de Tiempo.pptx", size:"512 KB", type:"PowerPoint", downloadUrl:"enlace de google drive" },{ name:"Lista de Eventos Sugeridos.pdf", size:"198 KB", type:"PDF", downloadUrl:"enlace desde github" }]
    }
];

const recursosDB = {
    Materiales: {
        Documentos: [
            { id:'mat-doc-1', title:"Manual de Redacción Periodística", description:"Guía completa sobre técnicas de redacción para medios de comunicación", type:"PDF", coverImage:"https://via.placeholder.com/400x250/3b82f6/ffffff?text=Manual+Redaccion", urlView:"https://drive.google.com/file/d/EJEMPLO1/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO1" },
            { id:'mat-doc-2', title:"Teorías de la Comunicación", description:"Documento académico sobre las principales teorías comunicativas", type:"PDF", coverImage:"https://via.placeholder.com/400x250/2563eb/ffffff?text=Teorias+Comunicacion", urlView:"https://drive.google.com/file/d/EJEMPLO2/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO2" }
        ],
        Videos: [
            { id:'mat-vid-1', title:"Introducción a la Comunicación Digital", description:"Video tutorial sobre fundamentos de comunicación en medios digitales", type:"Video", videoUrl:"https://www.youtube.com/embed/dQw4w9WgXcQ" }
        ],
        Imágenes: [
            { id:'mat-img-1', title:"Infografía: Proceso Comunicativo", description:"Representación visual del modelo de comunicación de Shannon y Weaver", type:"Imagen", imageUrl:"https://via.placeholder.com/600x400/10b981/ffffff?text=Proceso+Comunicativo" }
        ]
    },
    Cuentos: {
        Documentos: [{ id:'cue-doc-1', title:"Antología de Cuentos Latinoamericanos", description:"Colección de cuentos clásicos de autores latinoamericanos", type:"PDF", coverImage:"https://via.placeholder.com/400x250/f59e0b/ffffff?text=Cuentos+Latinoamericanos", urlView:"https://drive.google.com/file/d/EJEMPLO3/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO3" }],
        Videos: [], Imágenes: [{ id:'cue-img-1', title:"Ilustraciones de Cuentos", description:"Colección de imágenes ilustrativas de cuentos clásicos", type:"Imagen", imageUrl:"https://res.cloudinary.com/dwzwa3gp0/image/upload/v1769784312/image_89_anqelh.jpg" }]
    },
    Historias: {
        Documentos: [{ id:'his-doc-1', title:"Historias de la Comunicación Peruana", description:"Recopilación de historias sobre el desarrollo de los medios en Perú", type:"DOCX", coverImage:"https://via.placeholder.com/400x250/ef4444/ffffff?text=Historias+Peruanas", urlView:"https://docs.google.com/document/d/EJEMPLO4/preview", urlDownload:"https://docs.google.com/document/d/EJEMPLO4/export?format=docx" }],
        Videos: [], Imágenes: []
    },
    Leyendas: {
        Documentos: [{ id:'ley-doc-1', title:"Leyendas Peruanas Ilustradas", description:"Compilación de leyendas tradicionales del Perú con ilustraciones", type:"PDF", coverImage:"https://via.placeholder.com/400x250/8b5cf6/ffffff?text=Leyendas+Peruanas", urlView:"https://drive.google.com/file/d/EJEMPLO5/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO5" }],
        Videos: [], Imágenes: []
    },
    Poemas: {
        Documentos: [{ id:'poe-doc-1', title:"Poesía Contemporánea Peruana", description:"Selección de poemas de autores peruanos contemporáneos", type:"PDF", coverImage:"https://via.placeholder.com/400x250/ec4899/ffffff?text=Poesia+Peruana", urlView:"https://drive.google.com/file/d/EJEMPLO6/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO6" }],
        Videos: [], Imágenes: []
    },
    Libros: [
        { id:'lib-1', title:"Comunicación Organizacional Moderna", description:"Libro completo sobre estrategias de comunicación en organizaciones del siglo XXI", type:"PDF", coverImage:"https://via.placeholder.com/400x250/06b6d4/ffffff?text=Comunicacion+Organizacional", urlView:"https://drive.google.com/file/d/EJEMPLO7/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO7" },
        { id:'lib-2', title:"Semiótica y Análisis del Discurso", description:"Texto académico sobre análisis semiótico aplicado a la comunicación", type:"PDF", coverImage:"https://via.placeholder.com/400x250/14b8a6/ffffff?text=Semiotica", urlView:"https://drive.google.com/file/d/EJEMPLO8/preview", urlDownload:"https://drive.google.com/uc?export=download&id=EJEMPLO8" }
    ]
};

// ── Variables globales ────────────────────────────────────────────────────────
let currentRecursosCategory = 'Materiales';
let currentRecursosType     = 'Documentos';

const filesGrid             = document.getElementById('files-grid');
const assignmentsContainer  = document.getElementById('assignments-container');
const finalizadosContainer  = document.getElementById('finalizados-container');
const recursosContainer     = document.getElementById('recursos-container');
const docentesGrid          = document.getElementById('docentes-grid');

const sectionRepositorio = document.getElementById('repositorio');
const sectionTrabajos    = document.getElementById('trabajos');
const sectionRecursos    = document.getElementById('recursos');
const sectionDocentes    = document.getElementById('docentes');
const sectionEstudiantes = document.getElementById('estudiantes');

const trabajosPendientesSection  = document.getElementById('trabajos-pendientes-section');
const trabajosFinalizadosSection = document.getElementById('trabajos-finalizados-section');

const tabRepositorio = document.getElementById('tab-repositorio');
const tabTrabajos    = document.getElementById('tab-trabajos');
const tabRecursos    = document.getElementById('tab-recursos');
const tabDocentes    = document.getElementById('tab-docentes');
const tabEstudiantes = document.getElementById('tab-estudiantes');

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
function getCompletedAssignments() {
    const c = localStorage.getItem('completedAssignments');
    return c ? JSON.parse(c) : [];
}

function saveCompletedAssignment(assignmentId) {
    const c = getCompletedAssignments();
    if (!c.includes(assignmentId)) { c.push(assignmentId); localStorage.setItem('completedAssignments', JSON.stringify(c)); }
}

function getPendingAssignments()  { const c = getCompletedAssignments(); return assignmentsDB.filter(a => !c.includes(a.id)); }
function getFinishedAssignments() { const c = getCompletedAssignments(); return assignmentsDB.filter(a =>  c.includes(a.id)); }

// ============================================
// BÚSQUEDA
// ============================================
function toggleSearch(section) {
    const searchBar   = document.getElementById(`searchBar${section.charAt(0).toUpperCase() + section.slice(1)}`);
    const searchInput = searchBar.querySelector('input');
    searchBar.classList.toggle('active');
    if (searchBar.classList.contains('active')) {
        setTimeout(() => searchInput.focus(), 300);
    } else {
        searchInput.value = '';
        if (section === 'repositorio') searchFiles();
        else if (section === 'recursos') searchRecursos();
    }
}

function updatePendingBadge() {
    const pendingCount = getPendingAssignments().length;
    const badgeSidebar = document.getElementById('pending-badge');
    const badgeFooter  = document.getElementById('pending-badge-footer');
    if (pendingCount > 0) {
        if (badgeSidebar) badgeSidebar.style.display = 'block';
        if (badgeFooter)  badgeFooter.style.display  = 'block';
    } else {
        if (badgeSidebar) badgeSidebar.style.display = 'none';
        if (badgeFooter)  badgeFooter.style.display  = 'none';
    }
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
        if (category === 'Libros') {
            allRecursos = allRecursos.concat(recursosDB[category].map(r => ({ ...r, category })));
        } else {
            Object.keys(recursosDB[category]).forEach(type => {
                allRecursos = allRecursos.concat(recursosDB[category][type].map(r => ({ ...r, category, type })));
            });
        }
    });
    const filteredRecursos = allRecursos
        .map(r => ({ ...r, relevance: calculateRelevance(r, searchTerms, ['title','description']) }))
        .filter(r => r.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);
    recursosContainer.innerHTML = '';
    if (filteredRecursos.length === 0) {
        recursosContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No se encontraron recursos.</p>';
        return;
    }
    filteredRecursos.forEach(r => {
        if (r.type === 'Video')       renderVideoCard(r);
        else if (r.type === 'Imagen') renderImageCard(r);
        else                          renderDocumentCard(r);
    });
}

// ============================================
// RECURSOS
// ============================================
function filterRecursos(category) {
    currentRecursosCategory = category;
    currentRecursosType     = 'Documentos';
    const buttons = document.querySelectorAll('.recursos-filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.recursos-filter-btn').classList.add('active');
    const subMenu = document.getElementById('recursosSubMenu');
    if (category === 'Libros') {
        subMenu.style.display = 'none';
    } else {
        subMenu.style.display = 'flex';
        const subButtons = subMenu.querySelectorAll('.submenu-btn');
        subButtons.forEach(btn => btn.classList.remove('active'));
        subButtons[0].classList.add('active');
    }
    renderRecursosContent();
}

function toggleRecursosMenu(event, category) {
    event.stopPropagation();
    const subMenu   = document.getElementById('recursosSubMenu');
    const isVisible = subMenu.style.display === 'flex';
    if (!isVisible) {
        currentRecursosCategory = category;
        currentRecursosType     = 'Documentos';
        const buttons = document.querySelectorAll('.recursos-filter-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        event.target.closest('.recursos-filter-btn').classList.add('active');
        subMenu.style.display = 'flex';
        const subButtons = subMenu.querySelectorAll('.submenu-btn');
        subButtons.forEach(btn => btn.classList.remove('active'));
        subButtons[0].classList.add('active');
        renderRecursosContent();
    }
}

function filterRecursosType(type) {
    currentRecursosType = type;
    const subButtons = document.querySelectorAll('.submenu-btn');
    subButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderRecursosContent();
}

function renderRecursosContent() {
    recursosContainer.innerHTML = '';
    let recursos = [];
    if (currentRecursosCategory === 'Libros') {
        recursos = recursosDB.Libros;
    } else {
        const categoryData = recursosDB[currentRecursosCategory];
        if (categoryData && categoryData[currentRecursosType]) recursos = categoryData[currentRecursosType];
    }
    if (recursos.length === 0) {
        recursosContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No hay recursos disponibles en esta categoría.</p>';
        return;
    }
    recursos.forEach(recurso => {
        if (recurso.type === 'Video')       renderVideoCard(recurso);
        else if (recurso.type === 'Imagen') renderImageCard(recurso);
        else                                renderDocumentCard(recurso);
    });
}

function renderDocumentCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-card');
    let icon = 'fa-file-pdf';
    if (recurso.type === 'DOCX' || recurso.type === 'DOC')    icon = 'fa-file-word';
    else if (recurso.type === 'PPTX' || recurso.type === 'PPT') icon = 'fa-file-powerpoint';
    card.innerHTML = `
        <div class="recurso-cover">${recurso.coverImage ? `<img src="${recurso.coverImage}" alt="${recurso.title}">` : `<i class="fa-solid ${icon}"></i>`}</div>
        <div class="recurso-card-content">
            <span class="recurso-card-type">${recurso.type}</span>
            <h3 class="recurso-card-title">${recurso.title}</h3>
            <p class="recurso-card-description">${recurso.description}</p>
            <div class="recurso-card-actions">
                <button onclick="viewFile('${recurso.urlView}')" class="btn btn-view"><i class="fa-regular fa-eye"></i> Ver</button>
                <a href="${recurso.urlDownload}" download class="btn btn-download"><i class="fa-solid fa-download"></i> Descargar</a>
            </div>
        </div>
    `;
    recursosContainer.appendChild(card);
}

function renderVideoCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');
    card.innerHTML = `
        <div class="recurso-multimedia-content"><iframe src="${recurso.videoUrl}" frameborder="0" allowfullscreen></iframe></div>
        <div class="recurso-multimedia-description"><h3 style="color:var(--text-light);margin-bottom:.5rem;">${recurso.title}</h3><p>${recurso.description}</p></div>
    `;
    recursosContainer.appendChild(card);
}

function renderImageCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');
    card.innerHTML = `
        <div class="recurso-multimedia-content"><img src="${recurso.imageUrl}" alt="${recurso.title}"></div>
        <div class="recurso-multimedia-description"><h3 style="color:var(--text-light);margin-bottom:.5rem;">${recurso.title}</h3><p>${recurso.description}</p></div>
    `;
    recursosContainer.appendChild(card);
}

// ============================================
// REPOSITORIO
// ============================================
function renderFiles(filter = 'all') {
    currentFilter = filter;
    filesGrid.innerHTML = '';
    const filteredFiles = filter === 'all' ? filesDB : filesDB.filter(file => file.area === filter);
    renderFilesArray(filteredFiles);
}

function renderFilesArray(files) {
    filesGrid.innerHTML = '';
    if (files.length === 0) {
        filesGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);">No se encontraron archivos.</p>';
        return;
    }
    files.forEach(file => {
        const teacher = teachersDB[file.teacher];
        const card    = document.createElement('div');
        card.classList.add('file-card');
        let iconClass = 'fa-file-pdf';
        if (file.type === 'DOCX' || file.type === 'DOC')    iconClass = 'fa-file-word';
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
            </div>
        `;
        filesGrid.appendChild(card);
    });
}

function filterFiles(area) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderFiles(area);
    document.getElementById('searchInputRepositorio').value = '';
}

function viewFile(url) {
    fileViewerContent.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-header"><div class="skeleton-avatar"></div><div class="skeleton-text"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>
            <div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line medium"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
        </div>
    `;
    fileViewerModal.style.display = 'block';
    let previewUrl = url;
    if (!previewUrl.includes('/preview')) {
        if (previewUrl.includes('/edit')) previewUrl = previewUrl.replace('/edit', '/preview');
        else if (previewUrl.includes('drive.google.com/file/d/')) previewUrl = previewUrl.replace('/view', '/preview');
    }
    setTimeout(() => {
        fileViewerContent.innerHTML = `<iframe id="googleDriveFrame" src="${previewUrl}" frameborder="0" class="google-drive-iframe"></iframe>`;
    }, 800);
}

function openFullscreen() {
    const iframe = document.getElementById('googleDriveFrame');
    if (iframe) {
        if (!fullscreenCloseBtn) {
            fullscreenCloseBtn = document.createElement('button');
            fullscreenCloseBtn.className = 'fullscreen-close-btn';
            fullscreenCloseBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            fullscreenCloseBtn.onclick   = exitFullscreen;
            document.body.appendChild(fullscreenCloseBtn);
        }
        if (iframe.requestFullscreen)       iframe.requestFullscreen().then(() => fullscreenCloseBtn.classList.add('active'));
        else if (iframe.webkitRequestFullscreen) { iframe.webkitRequestFullscreen(); fullscreenCloseBtn.classList.add('active'); }
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    }
}

function exitFullscreen() {
    if (document.exitFullscreen)            document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    if (fullscreenCloseBtn) fullscreenCloseBtn.classList.remove('active');
}

function handleFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (fullscreenCloseBtn) fullscreenCloseBtn.classList.remove('active');
    }
}

function closeFileViewerModal() {
    fileViewerModal.style.display = 'none';
    fileViewerContent.innerHTML   = '';
    if (document.fullscreenElement || document.webkitFullscreenElement) exitFullscreen();
}

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
        trabajosPendientesSection.style.display  = 'none';
        trabajosFinalizadosSection.style.display = 'block';
        pendTitle.style.display  = 'none';
        finTitle.style.display   = 'block';
        btnText.textContent      = 'Ver trabajos pendientes';
        btnIcon.className        = 'fa-solid fa-clock';
        btn.classList.add('showing-finalizados');
        renderFinalizados();
    } else {
        trabajosPendientesSection.style.display  = 'block';
        trabajosFinalizadosSection.style.display = 'none';
        pendTitle.style.display  = 'block';
        finTitle.style.display   = 'none';
        btnText.textContent      = 'Ver trabajos finalizados';
        btnIcon.className        = 'fa-solid fa-check-circle';
        btn.classList.remove('showing-finalizados');
    }
}

function renderAssignments() {
    assignmentsContainer.innerHTML = '';
    const pendingAssignments = getPendingAssignments();
    if (pendingAssignments.length === 0) {
        assignmentsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay trabajos pendientes. ¡Excelente trabajo!</p>';
        return;
    }
    pendingAssignments.forEach(work => {
        const teacher   = teachersDB[work.teacher];
        let statusClass = '';
        switch(work.status) {
            case 'Pendiente': statusClass = 'status-pending';   break;
            case 'Entregado': statusClass = 'status-submitted'; break;
            case 'Atrasado':  statusClass = 'status-late';      break;
        }
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
                <button class="btn btn-view" onclick="openDetailsModal(${work.id})"><i class="fa-solid fa-info-circle"></i> Ver Detalles</button>
                <button class="btn btn-completed" onclick="openCompletedModal(${work.id})"><i class="fa-solid fa-check-circle"></i> Cumplido</button>
            </div>
        `;
        assignmentsContainer.appendChild(card);
    });
}

function renderFinalizados() {
    finalizadosContainer.innerHTML = '';
    const finishedAssignments = getFinishedAssignments();
    if (finishedAssignments.length === 0) {
        finalizadosContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay trabajos finalizados aún.</p>';
        return;
    }
    finishedAssignments.forEach(work => {
        const teacher = teachersDB[work.teacher];
        const card    = document.createElement('div');
        card.classList.add('assignment-card');
        card.innerHTML = `
            <div class="assignment-header"><h3 class="assignment-title">${work.task}</h3><span class="status-badge status-submitted">Finalizado</span></div>
            <div class="assignment-teacher">
                <img src="${teacher.photo}" alt="${teacher.name}" class="teacher-avatar-card" onclick="openProfileModal('${work.teacher}')">
                <div class="teacher-info"><span class="teacher-info-name">${teacher.name}</span><span class="teacher-info-title">${teacher.title}</span></div>
            </div>
            <div class="assignment-meta"><div class="meta-item"><i class="fa-regular fa-calendar"></i><span>Fecha límite: ${work.deadline}</span></div><div class="meta-item"><i class="fa-solid fa-check"></i><span>Completado</span></div></div>
            <div class="assignment-actions"><button class="btn btn-view" onclick="openDetailsModal(${work.id})"><i class="fa-solid fa-info-circle"></i> Ver Detalles</button></div>
        `;
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
function confirmCompleted() {
    if (currentAssignmentToComplete) { saveCompletedAssignment(currentAssignmentToComplete); updatePendingBadge(); renderAssignments(); closeCompletedModal(); }
}

// ============================================
// DOCENTES
// ============================================
function renderDocentes() {
    const teachersArray = Object.values(teachersDB);
    docentesGrid.innerHTML = '';
    teachersArray.forEach(teacher => {
        const card = document.createElement('div');
        card.classList.add('docente-card');
        card.innerHTML = `
            <img src="${teacher.photo}" alt="${teacher.name}" class="docente-avatar-large">
            <h3 class="docente-name">${teacher.name}</h3>
            <p class="docente-title">${teacher.title}</p>
            <div class="docente-info"><p><i class="fa-solid fa-envelope"></i> ${teacher.email}</p><p><i class="fa-solid fa-phone"></i> ${teacher.phone}</p></div>
        `;
        docentesGrid.appendChild(card);
    });
}

// ============================================
// MODALES
// ============================================
function openProfileModal(teacherName) {
    const teacher = teachersDB[teacherName];
    if (!teacher) return;
    modalProfileImage.src = teacher.photo;
    modalProfileImage.alt = teacher.name;
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
    document.getElementById('detailsStatus').innerHTML = isCompleted
        ? '<span class="status-badge status-submitted">Finalizado</span>'
        : `<span class="status-badge status-pending">${assignment.status}</span>`;
    document.getElementById('detailsDescription').textContent = assignment.description;
    const reqList = document.getElementById('detailsRequirements');
    reqList.innerHTML = '';
    assignment.requirements.forEach(req => { const li = document.createElement('li'); li.textContent = req; reqList.appendChild(li); });
    const attList = document.getElementById('detailsAttachments');
    attList.innerHTML = '';
    if (assignment.attachments && assignment.attachments.length > 0) {
        assignment.attachments.forEach(att => {
            const div = document.createElement('div');
            div.classList.add('attachment-item');
            let icon = 'fa-file-lines';
            if (att.type === 'PDF') icon = 'fa-file-pdf';
            else if (att.type === 'Word' || att.type === 'DOCX') icon = 'fa-file-word';
            else if (att.type === 'Excel') icon = 'fa-file-excel';
            else if (att.type === 'PowerPoint') icon = 'fa-file-powerpoint';
            div.innerHTML = `
                <div class="attachment-info"><i class="fa-solid ${icon} attachment-icon"></i><div class="attachment-details"><h5>${att.name}</h5><p>${att.size}</p></div></div>
                <a href="${att.downloadUrl}" target="_blank" class="attachment-download"><i class="fa-solid fa-download"></i> Descargar</a>
            `;
            attList.appendChild(div);
        });
    } else {
        attList.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">No hay archivos adjuntos</p>';
    }
    detailsModal.style.display = 'block';
}

function closeDetailsModal() { detailsModal.style.display = 'none'; }

window.onclick = function(event) {
    if (event.target === profileModal)    closeProfileModal();
    if (event.target === detailsModal)    closeDetailsModal();
    if (event.target === fileViewerModal) closeFileViewerModal();
    if (event.target === completedModal)  closeCompletedModal();
};

// ============================================
// SISTEMA DE REGISTRO DE ESTUDIANTES
// ============================================
let selectedEspecialidad = '';
let selectedCiclo        = '';
let selectedImageDataUrl = '';
let selectedImageFile    = null;

const CLOUDINARY_CONFIG = { CLOUD_NAME: "dwzwa3gp0", UPLOAD_PRESET: "hfqqxu13" };
const SUPABASE_CONFIG   = {
    URL: 'https://pauaqgfqsitnjsikrjns.supabase.co',
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdWFxZ2Zxc2l0bmpzaWtyam5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMxODYsImV4cCI6MjA4NjY2OTE4Nn0.Jz-rCRPQkgm9wXicGRoCP4xP-NotY-YEQXUyxgU7HeM'
};

let supabaseClient      = null;
let estudiantesListener = null;

function initSupabase() {
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
            return true;
        }
        return false;
    } catch(error) { console.error('Error al inicializar Supabase:', error); return false; }
}

document.addEventListener('DOMContentLoaded', function() { initSupabase(); });

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
    const modal = document.getElementById('registroModal');
    modal.style.display = 'none';
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
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

function mostrarToast(mensaje, icono = 'fa-check-circle', duracion = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fa-solid ${icono}"></i><span>${mensaje}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duracion);
}

async function registrarEstudiante() {
    const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
    const btnRegistrar   = document.getElementById('btnRegistrar');
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');

    if (!perfil || !perfil.foto_url) { alert('❌ No se encontró tu perfil. Cierra sesión e inicia nuevamente.'); return; }
    if (!nombreCompleto || nombreCompleto.length < 3) { alert('⚠️ El nombre es muy corto o está vacío.'); return; }
    if (!supabaseClient) { alert('❌ Error: No se pudo conectar con la base de datos.'); return; }

    btnRegistrar.disabled = true;
    btnRegistrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        let fotoUrl = perfil.foto_url;

        if (fotoUrl.startsWith('data:') && selectedImageFile) {
            const formData = new FormData();
            formData.append('file', selectedImageFile);
            formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
            formData.append('folder', 'estudiantes_clouddesk');
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            if (uploadRes.ok) { const cloudData = await uploadRes.json(); fotoUrl = cloudData.secure_url; perfil.foto_url = fotoUrl; }
        }

        const { data, error } = await supabaseClient
            .from('estudiantes')
            .insert([{ nombre_completo: nombreCompleto, foto_url: fotoUrl, especialidad: perfil.especialidad, ciclo: perfil.ciclo }])
            .select();

        if (error) throw new Error(`Error al guardar: ${error.message}`);

        perfil.supabase_registered = true;
        perfil.foto_url = fotoUrl;
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));

        actualizarPerfilSidebar();
        closeRegistroModal();
        mostrarToast('🎉 ¡Registro exitoso! Bienvenido/a a la comunidad CloudDesk');
        await cargarEstudiantes();

    } catch(error) {
        console.error('Error:', error);
        alert(`❌ Error: ${error.message}`);
    } finally {
        btnRegistrar.disabled  = false;
        btnRegistrar.innerHTML = '<i class="fa-solid fa-check-circle"></i> Unirme Ahora';
    }
}

async function cargarEstudiantes() {
    const grid    = document.getElementById('estudiantes-grid');
    const loading = document.getElementById('loading-estudiantes');
    if (!supabaseClient) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--danger);padding:2rem;">Error de conexión.</p>'; return; }
    try {
        if (loading) loading.style.display = 'block';
        const { data, error } = await supabaseClient.from('estudiantes').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        renderEstudiantesReales(data);
    } catch(error) {
        console.error('Error al cargar estudiantes:', error);
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--danger);padding:2rem;">Error: ${error.message}</p>`;
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderEstudiantesReales(estudiantes) {
    const grid    = document.getElementById('estudiantes-grid');
    const loading = document.getElementById('loading-estudiantes');
    if (loading) loading.style.display = 'none';
    if (!estudiantes || estudiantes.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);"><i class="fa-solid fa-users" style="font-size:4rem;margin-bottom:1rem;opacity:.5;"></i><p style="font-size:1.2rem;">Aún no hay estudiantes registrados.</p><p>¡Sé el primero en unirte!</p></div>`;
        return;
    }
    grid.innerHTML = '';
    estudiantes.forEach((estudiante, index) => {
        const card = document.createElement('div');
        card.classList.add('estudiante-card');
        card.style.animation      = 'fadeIn 0.5s ease';
        card.style.animationDelay = `${index * 0.1}s`;
        const espBadge = estudiante.especialidad ? `<p class="estudiante-especialidad"><i class="fa-solid fa-graduation-cap"></i> ${estudiante.especialidad} &nbsp;·&nbsp; Ciclo ${estudiante.ciclo || ''}</p>` : '';
        card.innerHTML = `
            <img src="${estudiante.foto_url}" alt="${estudiante.nombre_completo}" class="estudiante-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(estudiante.nombre_completo)}&background=3b82f6&color=fff&size=200'">
            <h3 class="estudiante-name">${estudiante.nombre_completo}</h3>
            ${espBadge}
            <p class="estudiante-date"><i class="fa-solid fa-calendar-check"></i> ${new Date(estudiante.created_at).toLocaleDateString('es-ES')}</p>
        `;
        grid.appendChild(card);
    });
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
        initial.style.display = 'flex';
        if (img) img.style.display = 'none';
    }
    const nameEl = document.getElementById('sidebar-profile-name');
    if (nameEl) nameEl.textContent = perfil.nombre;
}

function abrirPerfilEstudiante() {
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    const modal  = document.getElementById('modal-perfil-estudiante');
    if (!modal) return;
    if (!perfil) { openRegistroModal(); return; }
    document.getElementById('perfil-modal-nombre').textContent        = perfil.nombre;
    document.getElementById('perfil-modal-especialidad').textContent  = perfil.especialidad || '—';
    document.getElementById('perfil-modal-ciclo').textContent         = perfil.ciclo ? `Ciclo ${perfil.ciclo}` : '—';
    const img = document.getElementById('perfil-modal-foto');
    if (img) img.src = perfil.foto_url || '';
    modal.style.display = 'flex';
}

function cambiarFotoSidebar() {
    const input = document.getElementById('sidebar-foto-file-input');
    if (input) input.click();
}

async function procesarNuevaFotoPerfil(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('⚠️ La imagen es muy grande. Máximo 5MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('⚠️ Selecciona un archivo de imagen válido.'); return; }
    const perfil = JSON.parse(localStorage.getItem('eduspace_student_profile') || 'null');
    if (!perfil) { alert('❌ No se encontró tu perfil.'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgModal   = document.getElementById('perfil-modal-foto');
        const imgSidebar = document.getElementById('sidebar-profile-img');
        if (imgModal)   imgModal.src   = e.target.result;
        if (imgSidebar) imgSidebar.src = e.target.result;
    };
    reader.readAsDataURL(file);
    const btnCambiar = document.getElementById('btn-cambiar-foto-sidebar');
    if (btnCambiar) { btnCambiar.disabled = true; btnCambiar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...'; }
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
        formData.append('folder', 'estudiantes_clouddesk');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
        if (!res.ok) throw new Error('Error al subir la imagen');
        const data     = await res.json();
        const nuevaUrl = data.secure_url;
        if (supabaseClient && perfil.supabase_registered) {
            const { error } = await supabaseClient.from('estudiantes').update({ foto_url: nuevaUrl }).eq('nombre_completo', perfil.nombre);
            if (error) console.warn('No se actualizó en Supabase:', error.message);
        }
        // Actualizar también en Firebase
        const authData = JSON.parse(localStorage.getItem('eduspace_auth') || '{}');
        if (authData.codigo) {
            await _savePerfilToFirebase(authData.codigo, { ...perfil, foto_url: nuevaUrl }).catch(console.error);
        }
        perfil.foto_url = nuevaUrl;
        localStorage.setItem('eduspace_student_profile', JSON.stringify(perfil));
        actualizarPerfilSidebar();
        mostrarToast('✅ Foto actualizada correctamente');
    } catch(err) {
        console.error(err);
        alert('❌ Error al actualizar la foto: ' + err.message);
    } finally {
        if (btnCambiar) { btnCambiar.disabled = false; btnCambiar.innerHTML = '<i class="fa-solid fa-camera"></i> Cambiar foto'; }
        event.target.value = '';
    }
}

function cerrarPerfilEstudiante() {
    const modal = document.getElementById('modal-perfil-estudiante');
    if (modal) modal.style.display = 'none';
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

function switchTab(tab) {
    currentTab         = tab;
    showingFinalizados = false;
    if (window.innerWidth <= 768) closeSidebar();

    sectionRepositorio.style.display = 'none';
    sectionTrabajos.style.display    = 'none';
    sectionRecursos.style.display    = 'none';
    sectionDocentes.style.display    = 'none';
    sectionEstudiantes.style.display = 'none';

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
            const btnIcon = btn.querySelector('i');
            const btnTextSpan = document.getElementById('btn-trabajos-text');
            if (btnTextSpan) btnTextSpan.textContent = 'Ver trabajos finalizados';
            if (btnIcon)     btnIcon.className        = 'fa-solid fa-check-circle';
            btn.classList.remove('showing-finalizados');
        }
        renderAssignments();
    } else if (tab === 'recursos') {
        sectionRecursos.style.display = 'block';
        document.getElementById('tab-recursos').classList.add('active');
        renderRecursosContent();
    } else if (tab === 'docentes') {
        sectionDocentes.style.display = 'block';
        document.getElementById('tab-docentes').classList.add('active');
        renderDocentes();
    } else if (tab === 'estudiantes') {
        sectionEstudiantes.style.display = 'block';
        document.getElementById('tab-estudiantes').classList.add('active');
        renderEstudiantes();
    }

}

