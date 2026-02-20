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

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ============================================
// TIPO DE DISPOSITIVO
// ============================================
function getDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) return 'mobile';
    if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android.*mobile/i.test(userAgent)) return 'mobile';
    return 'desktop';
}

// ============================================
// FUNCIONES DE GESTIÓN DE ESTADO UI
// ============================================
function showConnectionLoader() {
    const loader = document.getElementById('connectionLoader');
    if (loader) loader.style.display = 'flex';
}

function hideConnectionLoader() {
    const loader = document.getElementById('connectionLoader');
    if (loader) loader.style.display = 'none';
}

function showAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'flex';
}

function hideAuthModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';
}

// ============================================
// ALMACENAMIENTO TEMPORAL EN sessionStorage
// - No toca Firebase ni localStorage hasta que todo esté validado.
// - sessionStorage sobrevive micro-redirects del popup de Google en laptops
//   (problema conocido en Chrome/Edge desktop con signInWithPopup).
// - Se borra automáticamente al cerrar el tab (más seguro que localStorage).
// ============================================
const _TV_KEY = '_cdsk_tv';

// Flag que indica que signInWithGoogle está en proceso activo.
// Evita que onAuthStateChanged interfiera (condición de carrera en móvil/laptop).
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
// PASO 1: Mostrar formulario nombre + código
// (este es el primer paso que ve el usuario)
// ============================================
function mostrarPaso1() {
    document.getElementById('auth-step-code').style.display = 'block';
    document.getElementById('auth-step-google').style.display = 'none';

    // Limpiar errores previos
    const errCode   = document.getElementById('authError');
    const errGoogle = document.getElementById('googleError');
    if (errCode)   { errCode.style.display = 'none';   errCode.textContent = ''; }
    if (errGoogle) { errGoogle.style.display = 'none'; errGoogle.textContent = ''; }

    // Restaurar botón de continuar
    const btn = document.getElementById('authSubmit');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

// ============================================
// PASO 2: Mostrar botón de Google
// (solo se llega aquí después de validar nombre+código)
// ============================================
function mostrarPaso2Google() {
    document.getElementById('auth-step-code').style.display = 'none';
    document.getElementById('auth-step-google').style.display = 'block';

    const errGoogle = document.getElementById('googleError');
    if (errGoogle) { errGoogle.style.display = 'none'; errGoogle.textContent = ''; }

    const btn = document.getElementById('googleSignInBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = googleBtnHTML();
    }

    // Mostrar qué código fue validado
    if (_getTempValidacion()) {
        const infoEl = document.getElementById('auth-codigo-validado');
        if (infoEl) {
            infoEl.textContent = `✅ Código "${_getTempValidacion().codigo}" verificado. Ahora vincula tu cuenta de Google.`;
        }
    }
}

// ============================================
// HTML DEL BOTÓN DE GOOGLE (reutilizable)
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
// GOOGLE SIGN-IN
// (solo se puede llegar aquí desde el Paso 2,
//  que solo aparece si el código fue validado)
// IMPORTANTE: llama completarRegistro() directamente desde el resultado
// del popup — NO delega a onAuthStateChanged — eso causaba el bug en laptop.
// ============================================
async function signInWithGoogle() {
    const btn      = document.getElementById('googleSignInBtn');
    const errorDiv = document.getElementById('googleError');

    // Seguridad: si no hay validación previa del código, no continuar.
    if (!_getTempValidacion()) {
        errorDiv.textContent = '⚠️ Error interno. Recarga la página e intenta de nuevo.';
        errorDiv.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando...`;
    errorDiv.style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        // Activar el flag ANTES del popup para que onAuthStateChanged
        // no interfiera cuando dispare justo después del login de Google.
        // Sin este flag, onAuthStateChanged vería authData=null y llamaría
        // user.delete(), destruyendo el usuario antes de que completarRegistro
        // pueda guardarlo. (Bug confirmado en móvil y laptop Chrome/Edge).
        _registrandoAhora = true;

        const result = await auth.signInWithPopup(provider);
        await completarRegistro(result.user);

    } catch (error) {
        console.error('Error Google Sign-In:', error);

        let mensaje = '❌ Error al iniciar sesión con Google. Intenta nuevamente.';
        if (error.code === 'auth/popup-closed-by-user') {
            mensaje = '⚠️ Cerraste la ventana de Google. Intenta nuevamente.';
        } else if (error.code === 'auth/popup-blocked') {
            mensaje = '⚠️ El navegador bloqueó la ventana emergente. Permite las ventanas emergentes e intenta de nuevo.';
        }

        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';

        btn.disabled = false;
        btn.innerHTML = googleBtnHTML();
    } finally {
        // Siempre desactivar el flag, incluso si hubo un error.
        _registrandoAhora = false;
    }
}

// ============================================
// UTILIDAD: NORMALIZAR NOMBRE PARA COMPARACIÓN
// ============================================
function normalizarNombre(nombre) {
    return nombre
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

// ============================================
// PASO 1: VALIDAR NOMBRE + CÓDIGO
// Solo lee Firebase, NO escribe nada.
// Si es válido, guarda en _tempValidacion y avanza al Paso 2.
// ============================================
async function validarCodigo() {
    const userName  = document.getElementById('authUserName').value.trim();
    const codigo    = document.getElementById('authCode').value.trim();
    const errorDiv  = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

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

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

    try {
        // ── Solo lectura: verificar que el código existe y es válido ──
        let snapshot;
        try {
            snapshot = await database.ref(`codigos/${codigo}`).once('value');
        } catch (fbError) {
            errorDiv.textContent = '⚠️ Error de conexión. Verifica tu internet e intenta nuevamente.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        if (!snapshot.exists()) {
            errorDiv.textContent = '❌ Código inválido. Verifica con el administrador.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        const codigoData       = snapshot.val();
        const dispositivosActuales = codigoData.dispositivos || {};
        const dispositivosKeys     = Object.keys(dispositivosActuales);

        // ── Verificar bloqueo ──
        if (codigoData.bloqueado === true) {
            const motivo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
            return;
        }

        // ── Verificar nombre (Capa A: propietario explícito) ──
        if (codigoData.propietario && codigoData.propietario.trim() !== '') {
            const propietarioNorm = normalizarNombre(codigoData.propietario);
            const userNameNorm    = normalizarNombre(userName);
            if (propietarioNorm !== userNameNorm) {
                errorDiv.innerHTML = `❌ El nombre ingresado no coincide con el registrado para este código.<br>
                    <small style="opacity:0.8;">Escríbelo exactamente como el administrador lo registró.</small>`;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
                return;
            }
        }
        // ── Verificar nombre (Capa B: candado automático del primer dispositivo) ──
        else if (dispositivosKeys.length > 0) {
            let nombrePrimerDispositivo = '';
            for (const key of dispositivosKeys) {
                const devUsuario = (dispositivosActuales[key].usuario || '').trim();
                if (devUsuario !== '') { nombrePrimerDispositivo = devUsuario; break; }
            }
            if (nombrePrimerDispositivo !== '') {
                const primerNorm   = normalizarNombre(nombrePrimerDispositivo);
                const userNameNorm = normalizarNombre(userName);
                if (primerNorm !== userNameNorm) {
                    errorDiv.innerHTML = `❌ El nombre ingresado no coincide con el titular de este código.<br>
                        <small style="opacity:0.8;">Este código ya está vinculado a otro usuario.</small>`;
                    errorDiv.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
                    return;
                }
            }
        }

        // ── Todo válido: guardar en memoria temporal (NO en Firebase todavía) ──
        _setTempValidacion({ userName, codigo, codigoData });

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';

        // ── Si Google ya está autenticado (ej: usuario regresó tras limpiar caché) ──
        // No hace falta mostrar el botón de Google, ir directo a registrar.
        const user = auth.currentUser;
        if (user) {
            await completarRegistro(user);
        } else {
            // Primera vez: mostrar el botón de Google
            mostrarPaso2Google();
        }

    } catch (error) {
        console.error('Error en validarCodigo:', error);
        errorDiv.textContent = '❌ Error de conexión. Por favor, intenta nuevamente.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
    }
}

// ============================================
// PASO FINAL: COMPLETAR REGISTRO EN FIREBASE
// Se llama desde onAuthStateChanged cuando:
//   a) El usuario acaba de hacer sign-in con Google (nueva cuenta), o
//   b) El usuario ya tenía Google activo y acaba de validar el código en Paso 1.
// Aquí sí se escribe en Firebase.
// ============================================
async function completarRegistro(user) {
    if (!_getTempValidacion()) {
        // No pasó por el Paso 1: cerrar sesión y mostrar formulario.
        // Esto corta cualquier intento de entrar solo con Google.
        console.warn('completarRegistro llamado sin _tempValidacion. Cerrando sesión.');
        await auth.signOut();
        showAuthModal();
        mostrarPaso1();
        return;
    }

    const { userName, codigo } = _getTempValidacion();
    const googleUid  = user.uid;
    const deviceType = getDeviceType();

    // ── Clave compuesta: googleUid + tipo de dispositivo ──────────────────
    // RAZÓN: móvil y laptop comparten el MISMO googleUid (misma cuenta Google).
    // Si usáramos solo googleUid como clave, el segundo dispositivo sobrescribiría
    // al primero en Firebase. Con la clave compuesta cada dispositivo tiene
    // su propia entrada:
    //   dispositivos/abc123uid_mobile   ← entrada del móvil
    //   dispositivos/abc123uid_desktop  ← entrada del laptop
    const deviceKey = `${googleUid}_${deviceType}`;

    // Mostrar spinner en el botón de Google si está visible
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
        googleBtn.disabled = true;
        googleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    }
    const googleErr = document.getElementById('googleError');
    if (googleErr) googleErr.style.display = 'none';

    try {
        // ── Re-leer datos frescos de Firebase (puede haber cambiado) ──
        const snapshot = await database.ref(`codigos/${codigo}`).once('value');
        const codigoData = snapshot.val();

        if (!codigoData) {
            await _cerrarSesionYMostrarError('❌ El código ya no existe en el sistema.');
            return;
        }

        if (codigoData.bloqueado === true) {
            const motivo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            await _cerrarSesionYMostrarError(`🚫 ACCESO BLOQUEADO: ${motivo}`);
            return;
        }

        const dispositivosActuales = codigoData.dispositivos || {};
        const dispositivosKeys     = Object.keys(dispositivosActuales);

        // ── Si este dispositivo (mismo UID + mismo tipo) ya está registrado → solo actualizar ──
        if (dispositivosActuales[deviceKey]) {
            const updates = {};
            updates[`codigos/${codigo}/dispositivos/${deviceKey}/usuario`]      = userName;
            updates[`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`] = new Date().toISOString();
            await database.ref().update(updates);

            _guardarSesionLocal(userName, codigo, googleUid, deviceType);
            _setTempValidacion(null);
            hideAuthModal();
            if (codigo === '6578hy') showSpecialUserMessage();
            iniciarListenerBloqueo();
            return;
        }

        // ── Verificar que no haya OTRA cuenta de Google ya registrada ──
        // Comparamos el googleUid del campo (no la clave) para detectar cuentas diferentes.
        if (dispositivosKeys.length > 0) {
            const otraCuenta = Object.values(dispositivosActuales).find(
                dev => dev.googleUid && dev.googleUid !== googleUid
            );
            if (otraCuenta) {
                await _cerrarSesionYMostrarError(
                    '🚫 Este código ya está vinculado a otra cuenta de Google. ' +
                    'Usa la misma cuenta de Google con la que te registraste originalmente.'
                );
                return;
            }
        }

        // ── Verificar límites de dispositivos ──
        const { mobile, desktop } = contarDispositivosPorTipo(dispositivosActuales);

        if (deviceType === 'mobile' && mobile >= 1) {
            await _cerrarSesionYMostrarError(
                '📱 Este código ya está en uso en 1 dispositivo móvil. Solo se permite 1 móvil por código.'
            );
            return;
        }

        if (deviceType === 'desktop' && desktop >= 1) {
            await _cerrarSesionYMostrarError(
                '💻 Este código ya está en uso en 1 computadora. Solo se permite 1 PC/laptop por código.'
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

        // ── Todo ok: escribir en Firebase con la clave compuesta ──
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
        hideAuthModal();
        if (codigo === '6578hy') showSpecialUserMessage();
        iniciarListenerBloqueo();

    } catch (error) {
        console.error('Error en completarRegistro:', error);
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = googleBtnHTML();
        }
        if (googleErr) {
            googleErr.textContent = '❌ Error de conexión. Por favor, intenta nuevamente.';
            googleErr.style.display = 'block';
        }
    } finally {
        // Garantizar que el flag se desactive siempre, pase lo que pase.
        _registrandoAhora = false;
    }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function _guardarSesionLocal(userName, codigo, googleUid, deviceType) {
    localStorage.setItem('eduspace_auth', JSON.stringify({
        userName, codigo, googleUid, deviceType, timestamp: Date.now()
    }));
}

async function _cerrarSesionYMostrarError(mensaje) {
    // ── 1. Eliminar al usuario de Firebase Auth completamente ──────────────
    // user.delete() borra el registro; funciona porque la autenticación
    // acaba de suceder (token fresco = no requiere re-autenticación).
    // Esto resuelve Bug 1: la cuenta de Google no queda guardada en Firebase
    // cuando el acceso es denegado.
    const userAEliminar = auth.currentUser;
    if (userAEliminar) {
        try {
            await userAEliminar.delete();
        } catch (deleteErr) {
            // Fallback: si delete falla por cualquier razón, al menos cerrar sesión.
            // Esto puede ocurrir si el token expiró o hubo un error de red.
            console.warn('user.delete() falló, usando signOut:', deleteErr.code);
            await auth.signOut().catch(e => console.error(e));
        }
    }

    // ── 2. Limpiar datos locales ──────────────────────────────────────────
    localStorage.removeItem('eduspace_auth');
    _setTempValidacion(null);

    // ── 3. Siempre volver al Paso 1 (nombre + código) ─────────────────────
    // Nunca volver al Paso 2 tras un error — evita que el usuario
    // intente inmediatamente con otra cuenta de Google (crearía otro
    // registro en Firebase Auth antes de que podamos borrarlo).
    showAuthModal();
    mostrarPaso1();
    const errDiv = document.getElementById('authError');
    if (errDiv) { errDiv.innerHTML = mensaje; errDiv.style.display = 'block'; }
}
async function validateAuthWithFirebase(googleUid) {
    const authData = localStorage.getItem('eduspace_auth');
    if (!authData) return false;

    try {
        const parsed = JSON.parse(authData);
        const { codigo, userName } = parsed;

        // Verificar que el UID guardado coincide con el usuario actual de Google
        if (parsed.googleUid !== googleUid) {
            localStorage.removeItem('eduspace_auth');
            return false;
        }

        const codigoRef = database.ref(`codigos/${codigo}`);
        const snapshot = await codigoRef.once('value');
        const codigoData = snapshot.val();

        if (!codigoData) {
            localStorage.removeItem('eduspace_auth');
            showAuthError('Código inválido o eliminado del sistema.');
            return false;
        }

        if (codigoData.bloqueado === true) {
            localStorage.removeItem('eduspace_auth');
            const motivoBloqueo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            showAuthError(`🚫 ACCESO BLOQUEADO: ${motivoBloqueo}`);
            return false;
        }

        // ── CAPA A: propietario explícito del admin ──
        if (codigoData.propietario && codigoData.propietario.trim() !== '') {
            const propietarioNorm = normalizarNombre(codigoData.propietario);
            const userNameNorm    = normalizarNombre(userName || '');
            if (propietarioNorm !== userNameNorm) {
                localStorage.removeItem('eduspace_auth');
                showAuthError('⚠️ La sesión guardada no es válida. Ingresa de nuevo con el nombre correcto.');
                return false;
            }
        }
        // ── CAPA B: candado automático desde el primer dispositivo ──
        else {
            const dispositivosActuales = codigoData.dispositivos || {};
            let nombrePrimerDispositivo = '';
            for (const key of Object.keys(dispositivosActuales)) {
                const devUsuario = (dispositivosActuales[key].usuario || '').trim();
                if (devUsuario !== '') {
                    nombrePrimerDispositivo = devUsuario;
                    break;
                }
            }
            if (nombrePrimerDispositivo !== '') {
                const primerNorm   = normalizarNombre(nombrePrimerDispositivo);
                const userNameNorm = normalizarNombre(userName || '');
                if (primerNorm !== userNameNorm) {
                    localStorage.removeItem('eduspace_auth');
                    showAuthError('⚠️ La sesión guardada no corresponde al titular de este código.');
                    return false;
                }
            }
        }

        // Verificar que este dispositivo (clave compuesta) está registrado bajo este código
        // La clave es googleUid_deviceType para distinguir móvil de laptop de la misma cuenta.
        const dispositivos = codigoData.dispositivos || {};
        const deviceType   = parsed.deviceType || getDeviceType();
        const deviceKey    = `${googleUid}_${deviceType}`;

        if (!dispositivos[deviceKey]) {
            localStorage.removeItem('eduspace_auth');
            showAuthError('Sesión inválida. Este dispositivo no está autorizado para este código.');
            return false;
        }

        // Actualizar último acceso
        await database.ref(`codigos/${codigo}/dispositivos/${deviceKey}/ultimoAcceso`).set(new Date().toISOString());

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
// MANEJO DE REGISTRO CON CÓDIGO (Google ya autenticado)
// ============================================
async function handleAuthSubmit() {
    const userName  = document.getElementById('authUserName').value.trim();
    const codigo    = document.getElementById('authCode').value.trim();
    const errorDiv  = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

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

    const user = auth.currentUser;
    if (!user) {
        errorDiv.textContent = '❌ Error de sesión. Por favor recarga la página.';
        errorDiv.style.display = 'block';
        return;
    }

    const googleUid  = user.uid;
    const deviceType = getDeviceType();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando...';

    try {
        let snapshot;
        try {
            snapshot = await database.ref(`codigos/${codigo}`).once('value');
        } catch (fbError) {
            console.error('Error Firebase:', fbError);
            errorDiv.textContent = '⚠️ Error de conexión. Verifica tu internet e intenta nuevamente.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }

        if (!snapshot.exists()) {
            errorDiv.textContent = '❌ Código inválido. Verifica con el administrador.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }

        const codigoData = snapshot.val();

        // ── 1. Verificar bloqueo ──
        if (codigoData.bloqueado === true) {
            const motivoBloqueo = codigoData.motivoBloqueo || 'Tu acceso ha sido bloqueado por el administrador.';
            errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivoBloqueo}`;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }

        const dispositivosActuales = codigoData.dispositivos || {};
        const dispositivosKeys     = Object.keys(dispositivosActuales);

        // ── 2. Verificación de nombre (Capa A: propietario explícito) ──
        if (codigoData.propietario && codigoData.propietario.trim() !== '') {
            const propietarioNorm = normalizarNombre(codigoData.propietario);
            const userNameNorm    = normalizarNombre(userName);

            if (propietarioNorm !== userNameNorm) {
                errorDiv.innerHTML = `
                    ❌ El nombre ingresado no coincide con el registrado para este código.<br>
                    <small style="opacity:0.8;">Escríbelo exactamente como el administrador lo registró.</small>
                `;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
                return;
            }
        }
        // ── 2. Verificación de nombre (Capa B: candado automático) ──
        else if (dispositivosKeys.length > 0) {
            let nombrePrimerDispositivo = '';
            for (const key of dispositivosKeys) {
                const devUsuario = (dispositivosActuales[key].usuario || '').trim();
                if (devUsuario !== '') {
                    nombrePrimerDispositivo = devUsuario;
                    break;
                }
            }

            if (nombrePrimerDispositivo !== '') {
                const primerNorm   = normalizarNombre(nombrePrimerDispositivo);
                const userNameNorm = normalizarNombre(userName);

                if (primerNorm !== userNameNorm) {
                    errorDiv.innerHTML = `
                        ❌ El nombre ingresado no coincide con el titular de este código.<br>
                        <small style="opacity:0.8;">Este código ya está vinculado a otro usuario.</small>
                    `;
                    errorDiv.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
                    return;
                }
            }
        }

        // ── 3. Si este Google UID ya está registrado bajo este código ──
        if (dispositivosActuales[googleUid]) {
            const updates = {};
            updates[`codigos/${codigo}/dispositivos/${googleUid}/usuario`] = userName;
            updates[`codigos/${codigo}/dispositivos/${googleUid}/ultimoAcceso`] = new Date().toISOString();
            await database.ref().update(updates);

            localStorage.setItem('eduspace_auth', JSON.stringify({
                userName, codigo, googleUid, deviceType, timestamp: Date.now()
            }));

            hideAuthModal();
            if (codigo === '6578hy') showSpecialUserMessage();
            iniciarListenerBloqueo();

            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }

        // ── 4. Verificar que no haya OTRA cuenta de Google diferente ya registrada ──
        // Regla: un código solo puede estar vinculado a UNA cuenta de Google.
        // El móvil y la laptop deben usar la misma cuenta.
        if (dispositivosKeys.length > 0) {
            const cuentaGoogleExistente = Object.values(dispositivosActuales).find(
                dev => dev.googleUid && dev.googleUid !== googleUid
            );

            if (cuentaGoogleExistente) {
                // Hay otro Google UID registrado → bloquear completamente
                errorDiv.innerHTML = `
                    🚫 Este código ya está vinculado a otra cuenta de Google.<br>
                    <small style="opacity:0.8;">
                        Solo se permite una cuenta de Google por código.
                        Inicia sesión con la cuenta de Google con la que te registraste originalmente.
                    </small>
                `;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';

                // Cerrar sesión de Google de la cuenta incorrecta
                await auth.signOut();
                localStorage.removeItem('eduspace_auth');

                // Volver al paso de Google para que inicie con la cuenta correcta
                setTimeout(() => {
                    mostrarPasoGoogle();
                }, 2500);
                return;
            }
        }

        // ── 5. Dispositivo nuevo: verificar límites ──
        const { mobile, desktop } = contarDispositivosPorTipo(dispositivosActuales);

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

        const totalDispositivos = dispositivosKeys.length;
        if (totalDispositivos >= 2) {
            errorDiv.textContent = '⚠️ Este código ya alcanzó el límite de 2 dispositivos (1 móvil + 1 PC).';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Ingresar';
            return;
        }

        // ── 6. Registrar nueva cuenta Google bajo este código ──
        // Usamos el googleUid como clave del dispositivo (único y estable)
        const updates = {};
        updates[`codigos/${codigo}/dispositivos/${googleUid}`] = {
            googleUid:     googleUid,
            googleEmail:   user.email,
            tipo:          deviceType,
            usuario:       userName,
            fechaRegistro: new Date().toISOString(),
            ultimoAcceso:  new Date().toISOString()
        };

        const usosRestantes = Math.max(0, 2 - (totalDispositivos + 1));
        updates[`codigos/${codigo}/usosRestantes`] = usosRestantes;
        if (usosRestantes === 0) {
            updates[`codigos/${codigo}/completado`] = true;
        }

        await database.ref().update(updates);

        localStorage.setItem('eduspace_auth', JSON.stringify({
            userName, codigo, googleUid, deviceType, timestamp: Date.now()
        }));

        hideAuthModal();
        if (codigo === '6578hy') showSpecialUserMessage();
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

// ============================================
// INICIALIZACIÓN
// ============================================
let _appInicializada = false; // evita que onAuthStateChanged arranque la app dos veces

document.addEventListener('DOMContentLoaded', async () => {
    showConnectionLoader();

    // Botón "Continuar" del Paso 1
    const submitBtn = document.getElementById('authSubmit');
    if (submitBtn) submitBtn.addEventListener('click', validarCodigo);

    document.getElementById('authUserName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') validarCodigo();
    });
    document.getElementById('authCode')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') validarCodigo();
    });

    // ── Firebase Auth detecta sesión automáticamente (IndexedDB, sobrevive al caché) ──
    //
    // ROLES de onAuthStateChanged:
    //   ✓ Usuario que REGRESA (tiene localStorage con su código) → validar y entrar
    //   ✓ Carga inicial sin sesión → mostrar Paso 1
    //   ✗ NO llama completarRegistro para nuevos registros.
    //     Eso lo hace signInWithGoogle() directamente (evita condición de carrera en laptop).
    //
    auth.onAuthStateChanged(async (user) => {
        hideConnectionLoader();

        if (user) {
            const authData = localStorage.getItem('eduspace_auth');

            if (authData) {
                // ── CASO A: Usuario que regresa con sesión guardada ──────────
                // Su código fue registrado en una sesión anterior.
                // Validar que el código sigue vigente y el UID coincide.
                const ok = await validateAuthWithFirebase(user.uid);
                if (ok) {
                    hideAuthModal();
                    iniciarListenerBloqueo();
                } else {
                    // Código bloqueado/eliminado o UID no coincide.
                    // No cerramos sesión de Google (el usuario legítimo solo necesita
                    // volver a ingresar su código si cambió algo).
                    showAuthModal();
                    mostrarPaso1();
                }
            } else {
                // ── CASO B: Google activo pero sin código guardado ────────────
                //
                // Si _registrandoAhora = true, significa que signInWithGoogle()
                // lanzó el popup y está en medio de completarRegistro().
                // onAuthStateChanged disparó por el login del popup antes de que
                // completarRegistro() pudiera guardar authData.
                // En ese caso NO hacer nada — completarRegistro() ya se encarga.
                //
                // Si _registrandoAhora = false, no hay registro en progreso:
                // puede ser alguien que manipuló el flujo o un estado inconsistente.
                // En ese caso sí eliminar y pedir Paso 1.
                if (_registrandoAhora) {
                    // Registro en progreso — ignorar este evento de onAuthStateChanged.
                    // completarRegistro() terminará y guardará authData pronto.
                    return;
                }

                // Sin registro en progreso → estado inconsistente. Limpiar.
                try {
                    await user.delete();
                } catch (e) {
                    await auth.signOut().catch(console.error);
                }
                showAuthModal();
                mostrarPaso1();
            }
        } else {
            // ── CASO C: Sin sesión de Google ──────────────────────────────────
            showAuthModal();
            mostrarPaso1();
        }

        // Inicializar tabs/badges solo la primera vez que carga la app
        if (!_appInicializada) {
            _appInicializada = true;
            updatePendingBadge();
            switchTab('repositorio');
        }
    });
});

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

        if (bloqueoListener) {
            database.ref(`codigos/${codigo}/bloqueado`).off('value', bloqueoListener);
        }

        bloqueoListener = database.ref(`codigos/${codigo}/bloqueado`).on('value', (snapshot) => {
            const estaBloqueado = snapshot.val();

            if (estaBloqueado === true) {
                database.ref(`codigos/${codigo}/motivoBloqueo`).once('value', async (motivoSnapshot) => {
                    const motivo = motivoSnapshot.val() || 'Tu acceso ha sido bloqueado por el administrador.';

                    // Cerrar sesión de Google y limpiar datos
                    await auth.signOut().catch(e => console.error(e));
                    localStorage.removeItem('eduspace_auth');
                    _setTempValidacion(null);

                    showAuthModal();
                    mostrarPaso1();

                    const errorDiv = document.getElementById('authError');
                    if (errorDiv) {
                        errorDiv.textContent = `🚫 ACCESO BLOQUEADO: ${motivo}`;
                        errorDiv.style.display = 'block';
                    }

                    const submitBtn = document.getElementById('authSubmit');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Acceso Bloqueado';
                    }

                    hideSpecialUserMessage();
                });

            } else if (estaBloqueado === false) {
                const authDataNow = localStorage.getItem('eduspace_auth');
                const user = auth.currentUser;

                if (authDataNow && user) {
                    validateAuthWithFirebase(user.uid).then(isValid => {
                        if (isValid) {
                            hideAuthModal();

                            const errCode = document.getElementById('authError');
                            if (errCode) { errCode.textContent = ''; errCode.style.display = 'none'; }

                            const submitBtn = document.getElementById('authSubmit');
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continuar';
                            }

                            const parsed2 = JSON.parse(authDataNow);
                            if (parsed2.codigo === '6578hy') showSpecialUserMessage();

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

    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => notif.remove(), 500);
    }, 5000);
}

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
// BASE DE DATOS
// ============================================

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
        title: "Doctora en Biológicas",
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

const filesDB = [
    {
        id: 1,
        title: "Guía de Álgebra Avanzada",
        area: "Matemáticas",
        teacher: "Prof. Alejandro Ruiz",
        date: "2025-05-10",
        type: "PDF",
        urlView: "https://docs.google.com/document/d/1u223FM_asu6nkbkHdYPc48QyOMow7sDH/edit?usp=drive_link&ouid=110125860748103327612&rtpof=true&sd=true",
        urlDownload: "https://res.cloudinary.com/dwzwa3gp0/raw/upload/v1766695102/D%C3%89FICIT_DE_PROYECTO_DE_INVESTIGACI%C3%93N_mxcrj4.docx"
    },
    {
        id: 2,
        title: "La Célula y sus partes",
        area: "Ciencias",
        teacher: "Dra. María González",
        date: "2025-05-12",
        type: "PPTX",
        urlView: "https://docs.google.com/presentation/d/1234567890/preview",
        urlDownload: "https://docs.google.com/presentation/d/1234567890/export/pptx"
    },
    {
        id: 3,
        title: "Ensayo: Realismo Mágico",
        area: "Literatura",
        teacher: "Lic. Carlos Fuentes",
        date: "2025-05-14",
        type: "DOCX",
        urlView: "https://docs.google.com/document/d/1234567890/preview",
        urlDownload: "https://docs.google.com/document/d/1234567890/export?format=docx"
    },
    {
        id: 4,
        title: "Revolución Industrial",
        area: "Historia",
        teacher: "Prof. Diana Prince",
        date: "2025-05-15",
        type: "PDF",
        urlView: "https://drive.google.com/file/d/1234567890/preview",
        urlDownload: "https://drive.google.com/uc?export=download&id=1234567890"
    },
    {
        id: 5,
        title: "Ejercicios de Trigonometría",
        area: "Matemáticas",
        teacher: "Prof. Alejandro Ruiz",
        date: "2025-05-18",
        type: "PDF",
        urlView: "https://drive.google.com/file/d/0987654321/preview",
        urlDownload: "https://drive.google.com/uc?export=download&id=0987654321"
    }
];

const assignmentsDB = [
    {
        id: 101,
        task: "Informe de Laboratorio #3",
        teacher: "Dra. María González",
        deadline: "2025-05-25",
        status: "Pendiente",
        description: "Realizar un informe completo sobre el experimento de fotosíntesis realizado en clase. El informe debe incluir introducción, metodología, resultados, análisis y conclusiones. Se espera un trabajo detallado que demuestre comprensión del proceso científico.",
        requirements: [
            "Mínimo 5 páginas, máximo 8 páginas",
            "Incluir gráficos y tablas de los datos obtenidos",
            "Referencias bibliográficas en formato APA",
            "Análisis crítico de los resultados",
            "Conclusiones basadas en evidencia científica"
        ],
        attachments: [
            {
                name: "Guía del Informe.pdf",
                size: "245 KB",
                type: "PDF",
                downloadUrl: "enlace de google drive"
            },
            {
                name: "Datos del Experimento.xlsx",
                size: "128 KB",
                type: "Excel",
                downloadUrl: "enlace desde google drive"
            }
        ]
    },
    {
        id: 102,
        task: "Análisis de 'Cien Años de Soledad'",
        teacher: "Lic. Carlos Fuentes",
        deadline: "2025-05-20",
        status: "Pendiente",
        description: "Realizar un análisis literario profundo de la obra 'Cien Años de Soledad' de Gabriel García Márquez. El análisis debe cubrir los temas principales, el uso del realismo mágico, la estructura narrativa y el contexto histórico-social de la obra.",
        requirements: [
            "Ensayo de 6-8 páginas",
            "Análisis de al menos 3 personajes principales",
            "Identificación de elementos del realismo mágico",
            "Contexto histórico y social de la obra",
            "Citas textuales debidamente referenciadas"
        ],
        attachments: [
            {
                name: "Rúbrica de Evaluación.pdf",
                size: "156 KB",
                type: "PDF",
                downloadUrl: "enlace de google drive"
            },
            {
                name: "Ejemplos de Análisis.docx",
                size: "89 KB",
                type: "Word",
                downloadUrl: "enlace desde github"
            }
        ]
    },
    {
        id: 103,
        task: "Línea de tiempo S.XIX",
        teacher: "Prof. Diana Prince",
        deadline: "2025-05-10",
        status: "Pendiente",
        description: "Crear una línea de tiempo interactiva que muestre los eventos más importantes del siglo XIX a nivel mundial. La línea debe incluir eventos políticos, sociales, culturales y tecnológicos, con imágenes y descripciones breves de cada acontecimiento.",
        requirements: [
            "Mínimo 20 eventos históricos relevantes",
            "Incluir imágenes representativas de cada evento",
            "Descripción de 50-100 palabras por evento",
            "Formato digital (PowerPoint, Prezi o similar)",
            "Presentación visual atractiva y organizada"
        ],
        attachments: [
            {
                name: "Plantilla Línea de Tiempo.pptx",
                size: "512 KB",
                type: "PowerPoint",
                downloadUrl: "enlace de google drive"
            },
            {
                name: "Lista de Eventos Sugeridos.pdf",
                size: "198 KB",
                type: "PDF",
                downloadUrl: "enlace desde github"
            }
        ]
    }
];

// ============================================
// BASE DE DATOS DE RECURSOS
// ============================================
const recursosDB = {
    Materiales: {
        Documentos: [
            {
                id: 'mat-doc-1',
                title: "Manual de Redacción Periodística",
                description: "Guía completa sobre técnicas de redacción para medios de comunicación",
                type: "PDF",
                coverImage: "https://via.placeholder.com/400x250/3b82f6/ffffff?text=Manual+Redaccion",
                urlView: "https://drive.google.com/file/d/EJEMPLO1/preview",
                urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO1"
            },
            {
                id: 'mat-doc-2',
                title: "Teorías de la Comunicación",
                description: "Documento académico sobre las principales teorías comunicativas",
                type: "PDF",
                coverImage: "https://via.placeholder.com/400x250/2563eb/ffffff?text=Teorias+Comunicacion",
                urlView: "https://drive.google.com/file/d/EJEMPLO2/preview",
                urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO2"
            },
            {
                id: 'mat-doc-3',
                title: "Teorías de la Comunicación",
                description: "Documento académico sobre las principales teorías comunicativas",
                type: "PDF",
                coverImage: "https://via.placeholder.com/400x250/2563eb/ffffff?text=Teorias+Comunicacion",
                urlView: "https://drive.google.com/file/d/EJEMPLO2/preview",
                urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO2"
            }
        ],
        Videos: [
            {
                id: 'mat-vid-1',
                title: "Introducción a la Comunicación Digital",
                description: "Video tutorial sobre fundamentos de comunicación en medios digitales",
                type: "Video",
                videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
            }
        ],
        Imágenes: [
            {
                id: 'mat-img-1',
                title: "Infografía: Proceso Comunicativo",
                description: "Representación visual del modelo de comunicación de Shannon y Weaver",
                type: "Imagen",
                imageUrl: "https://via.placeholder.com/600x400/10b981/ffffff?text=Proceso+Comunicativo"
            }
        ]
    },
    Cuentos: {
        Documentos: [
            {
                id: 'cue-doc-1',
                title: "Antología de Cuentos Latinoamericanos",
                description: "Colección de cuentos clásicos de autores latinoamericanos",
                type: "PDF",
                coverImage: "https://via.placeholder.com/400x250/f59e0b/ffffff?text=Cuentos+Latinoamericanos",
                urlView: "https://drive.google.com/file/d/EJEMPLO3/preview",
                urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO3"
            }
        ],
        Videos: [
          {
                id: 'mat-vid-1',
                title: "Introducción a la Comunicación Digital",
                description: "Video tutorial sobre fundamentos de comunicación en medios digitales",
                type: "Video",
                videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
            }
        ],
        Imágenes: [
           {
                id: 'mat-img-1',
                title: "Infografía: Proceso Comunicativo",
                description: "Representación visual del modelo de comunicación de Shannon y Weaver",
                type: "Imagen",
                imageUrl: "https://res.cloudinary.com/dwzwa3gp0/image/upload/v1769784312/image_89_anqelh.jpg"
            }
        ]
    },
    Historias: {
        Documentos: [
            {
                id: 'his-doc-1',
                title: "Historias de la Comunicación Peruana",
                description: "Recopilación de historias sobre el desarrollo de los medios en Perú",
                type: "DOCX",
                coverImage: "https://via.placeholder.com/400x250/ef4444/ffffff?text=Historias+Peruanas",
                urlView: "https://docs.google.com/document/d/EJEMPLO4/preview",
                urlDownload: "https://docs.google.com/document/d/EJEMPLO4/export?format=docx"
            }
        ],
        Videos: [],
        Imágenes: []
    },
    Leyendas: {
        Documentos: [
            {
                id: 'ley-doc-1',
                title: "Leyendas Peruanas Ilustradas",
                description: "Compilación de leyendas tradicionales del Perú con ilustraciones",
                type: "PDF",
                coverImage: "https://via.placeholder.com/400x250/8b5cf6/ffffff?text=Leyendas+Peruanas",
                urlView: "https://drive.google.com/file/d/EJEMPLO5/preview",
                urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO5"
            }
        ],
        Videos: [],
        Imágenes: []
    },
    Poemas: {
        Documentos: [
            {
                id: 'poe-doc-1',
                title: "Poesía Contemporánea Peruana",
                description: "Selección de poemas de autores peruanos contemporáneos",
                type: "PDF",
                coverImage: "https://via.placeholder.com/400x250/ec4899/ffffff?text=Poesia+Peruana",
                urlView: "https://drive.google.com/file/d/EJEMPLO6/preview",
                urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO6"
            }
        ],
        Videos: [],
        Imágenes: []
    },
    Libros: [
        {
            id: 'lib-1',
            title: "Comunicación Organizacional Moderna",
            description: "Libro completo sobre estrategias de comunicación en organizaciones del siglo XXI",
            type: "PDF",
            coverImage: "https://via.placeholder.com/400x250/06b6d4/ffffff?text=Comunicacion+Organizacional",
            urlView: "https://drive.google.com/file/d/EJEMPLO7/preview",
            urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO7"
        },
        {
            id: 'lib-2',
            title: "Semiótica y Análisis del Discurso",
            description: "Texto académico sobre análisis semiótico aplicado a la comunicación",
            type: "PDF",
            coverImage: "https://via.placeholder.com/400x250/14b8a6/ffffff?text=Semiotica",
            urlView: "https://drive.google.com/file/d/EJEMPLO8/preview",
            urlDownload: "https://drive.google.com/uc?export=download&id=EJEMPLO8"
        }
    ]
};

// Variables globales
let currentRecursosCategory = 'Materiales';
let currentRecursosType = 'Documentos';

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
        if (section === 'repositorio') {
            searchFiles();
        } else if (section === 'recursos') {
            searchRecursos();
        }
    }
}

function updatePendingBadge() {
    const pendingCount = getPendingAssignments().length;
    const badgeSidebar = document.getElementById('pending-badge');
    const badgeFooter = document.getElementById('pending-badge-footer');

    if (pendingCount > 0) {
        if (badgeSidebar) badgeSidebar.style.display = 'block';
        if (badgeFooter) badgeFooter.style.display = 'block';
    } else {
        if (badgeSidebar) badgeSidebar.style.display = 'none';
        if (badgeFooter) badgeFooter.style.display = 'none';
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
                } else if (field.startsWith(term)) {
                    score += 5;
                } else {
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
    let searchTerm = document.getElementById('searchInputRepositorio').value.toLowerCase().trim();

    if (searchTerm === '') {
        renderFiles(currentFilter);
        return;
    }

    const searchTerms = normalizeText(searchTerm).split(/\s+/);

    const filteredFiles = filesDB
        .filter(file => currentFilter === 'all' || file.area === currentFilter)
        .map(file => ({
            ...file,
            relevance: calculateRelevance(file, searchTerms, ['title', 'area', 'teacher'])
        }))
        .filter(file => file.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

    renderFilesArray(filteredFiles);
}

// ============================================
// FUNCIONES PARA RECURSOS
// ============================================

function filterRecursos(category) {
    currentRecursosCategory = category;
    currentRecursosType = 'Documentos';

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

    const subMenu = document.getElementById('recursosSubMenu');
    const isVisible = subMenu.style.display === 'flex';

    if (!isVisible) {
        currentRecursosCategory = category;
        currentRecursosType = 'Documentos';

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
        if (categoryData && categoryData[currentRecursosType]) {
            recursos = categoryData[currentRecursosType];
        }
    }

    if (recursos.length === 0) {
        recursosContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No hay recursos disponibles en esta categoría.</p>';
        return;
    }

    recursos.forEach(recurso => {
        if (recurso.type === 'Video') {
            renderVideoCard(recurso);
        } else if (recurso.type === 'Imagen') {
            renderImageCard(recurso);
        } else {
            renderDocumentCard(recurso);
        }
    });
}

function renderDocumentCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-card');

    let icon = 'fa-file-pdf';
    if (recurso.type === 'DOCX' || recurso.type === 'DOC') icon = 'fa-file-word';
    else if (recurso.type === 'PPTX' || recurso.type === 'PPT') icon = 'fa-file-powerpoint';

    card.innerHTML = `
        <div class="recurso-cover">
            ${recurso.coverImage ? `<img src="${recurso.coverImage}" alt="${recurso.title}">` : `<i class="fa-solid ${icon}"></i>`}
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
        </div>
    `;

    recursosContainer.appendChild(card);
}

function renderVideoCard(recurso) {
    const card = document.createElement('div');
    card.classList.add('recurso-multimedia-card');

    card.innerHTML = `
        <div class="recurso-multimedia-content">
            <iframe src="${recurso.videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
        <div class="recurso-multimedia-description">
            <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">${recurso.title}</h3>
            <p>${recurso.description}</p>
        </div>
    `;

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
            <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">${recurso.title}</h3>
            <p>${recurso.description}</p>
        </div>
    `;

    recursosContainer.appendChild(card);
}

function searchRecursos() {
    let searchTerm = document.getElementById('searchInputRecursos').value.toLowerCase().trim();

    if (searchTerm === '') {
        renderRecursosContent();
        return;
    }

    const searchTerms = normalizeText(searchTerm).split(/\s+/);
    let allRecursos = [];

    Object.keys(recursosDB).forEach(category => {
        if (category === 'Libros') {
            allRecursos = allRecursos.concat(recursosDB[category].map(r => ({...r, category})));
        } else {
            Object.keys(recursosDB[category]).forEach(type => {
                allRecursos = allRecursos.concat(recursosDB[category][type].map(r => ({...r, category, type})));
            });
        }
    });

    const filteredRecursos = allRecursos
        .map(recurso => ({
            ...recurso,
            relevance: calculateRelevance(recurso, searchTerms, ['title', 'description'])
        }))
        .filter(recurso => recurso.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

    recursosContainer.innerHTML = '';

    if (filteredRecursos.length === 0) {
        recursosContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron recursos.</p>';
        return;
    }

    filteredRecursos.forEach(recurso => {
        if (recurso.type === 'Video') {
            renderVideoCard(recurso);
        } else if (recurso.type === 'Imagen') {
            renderImageCard(recurso);
        } else {
            renderDocumentCard(recurso);
        }
    });
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

        let iconClass = 'fa-file-pdf';
        if (file.type === 'DOCX' || file.type === 'DOC') iconClass = 'fa-file-word';
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

    const pendientesTitle = document.getElementById('trabajos-pendientes-title');
    const finalizadosTitle = document.getElementById('trabajos-finalizados-title');

    if (showingFinalizados) {
        trabajosPendientesSection.style.display = 'none';
        trabajosFinalizadosSection.style.display = 'block';
        pendientesTitle.style.display = 'none';
        finalizadosTitle.style.display = 'block';
        btnText.textContent = 'Ver trabajos pendientes';
        btnIcon.className = 'fa-solid fa-clock';
        btn.classList.add('showing-finalizados');
        renderFinalizados();
    } else {
        trabajosPendientesSection.style.display = 'block';
        trabajosFinalizadosSection.style.display = 'none';
        pendientesTitle.style.display = 'block';
        finalizadosTitle.style.display = 'none';
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

function renderDocentes() {
    const teachersArray = Object.values(teachersDB);
    docentesGrid.innerHTML = '';

    if (teachersArray.length === 0) {
        docentesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No se encontraron docentes.</p>';
        return;
    }

    teachersArray.forEach(teacher => {
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

function filterFiles(area) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderFiles(area);
    document.getElementById('searchInputRepositorio').value = '';
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
// SISTEMA DE REGISTRO DE ESTUDIANTES
// ============================================

const CLOUDINARY_CONFIG = {
    CLOUD_NAME: "dwzwa3gp0",
    UPLOAD_PRESET: "hfqqxu13"
};

const SUPABASE_CONFIG = {
    URL: 'https://pauaqgfqsitnjsikrjns.supabase.co',
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdWFxZ2Zxc2l0bmpzaWtyam5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTMxODYsImV4cCI6MjA4NjY2OTE4Nn0.Jz-rCRPQkgm9wXicGRoCP4xP-NotY-YEQXUyxgU7HeM'
};

let supabaseClient = null;
let estudiantesListener = null;
let selectedImageFile = null;

function initSupabase() {
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
            console.log('✅ Supabase inicializado correctamente');
            return true;
        } else {
            console.error('❌ Supabase no está cargado. Verifica el CDN.');
            return false;
        }
    } catch (error) {
        console.error('❌ Error al inicializar Supabase:', error);
        return false;
    }
}

function openRegistroModal() {
    const modal = document.getElementById('registroModal');
    const terminosContainer = document.querySelector('.terminos-container');
    const formRegistro = document.getElementById('form-registro');

    modal.style.display = 'block';

    document.getElementById('aceptoTerminos').checked = false;
    document.getElementById('nombreCompleto').value = '';
    selectedImageFile = null;
    resetImagePreview();

    terminosContainer.style.display = 'block';
    terminosContainer.style.opacity = '1';
    terminosContainer.style.transform = 'translateY(0)';

    formRegistro.style.display = 'none';
    formRegistro.style.opacity = '0';
    formRegistro.style.transform = 'translateY(20px)';
}

function closeRegistroModal() {
    const modal = document.getElementById('registroModal');
    modal.style.display = 'none';
}

function previewImage(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('⚠️ La imagen es muy grande. El tamaño máximo es 5MB.');
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('⚠️ Por favor selecciona un archivo de imagen válido.');
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('uploadPlaceholder').style.display = 'none';
        document.getElementById('imagePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function resetImagePreview() {
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
    document.getElementById('fotoInput').value = '';
}

function mostrarToast(mensaje, icono = 'fa-check-circle', duracion = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <i class="fa-solid ${icono}"></i>
        <span>${mensaje}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duracion);
}

async function registrarEstudiante() {
    const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
    const btnRegistrar = document.getElementById('btnRegistrar');

    if (!nombreCompleto) {
        alert('⚠️ Por favor ingresa tu nombre completo.');
        return;
    }

    if (nombreCompleto.length < 3) {
        alert('⚠️ El nombre debe tener al menos 3 caracteres.');
        return;
    }

    if (!selectedImageFile) {
        alert('⚠️ Por favor selecciona una foto de perfil.');
        return;
    }

    if (!supabaseClient) {
        alert('❌ Error: No se pudo conectar con la base de datos. Recarga la página.');
        return;
    }

    btnRegistrar.disabled = true;
    btnRegistrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo foto...';

    try {
        const formData = new FormData();
        formData.append('file', selectedImageFile);
        formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
        formData.append('folder', 'estudiantes_clouddesk');

        const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!uploadResponse.ok) {
            throw new Error('Error al subir la imagen a Cloudinary');
        }

        const cloudinaryData = await uploadResponse.json();
        const fotoUrl = cloudinaryData.secure_url;

        btnRegistrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando datos...';

        const { data, error } = await supabaseClient
            .from('estudiantes')
            .insert([
                {
                    nombre_completo: nombreCompleto,
                    foto_url: fotoUrl
                }
            ])
            .select();

        if (error) {
            throw new Error(`Error al guardar: ${error.message}`);
        }

        closeRegistroModal();
        mostrarToast('🎉 ¡Registro exitoso! Bienvenido/a a CloudDesk');
        await cargarEstudiantes();

    } catch (error) {
        console.error('❌ Error completo:', error);
        alert(`❌ Error: ${error.message}\n\nPor favor, intenta nuevamente.`);
    } finally {
        btnRegistrar.disabled = false;
        btnRegistrar.innerHTML = '<i class="fa-solid fa-check-circle"></i> Registrarme Ahora';
    }
}

async function cargarEstudiantes() {
    const grid = document.getElementById('estudiantes-grid');
    const loading = document.getElementById('loading-estudiantes');

    if (!supabaseClient) {
        grid.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 2rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i><br>
                Error: No se pudo conectar con la base de datos.
            </p>
        `;
        return;
    }

    try {
        if (loading) loading.style.display = 'block';

        const { data, error } = await supabaseClient
            .from('estudiantes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderEstudiantesReales(data);

    } catch (error) {
        console.error('❌ Error al cargar estudiantes:', error);
        grid.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 2rem;">
                Error al cargar estudiantes: ${error.message}
            </p>
        `;
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderEstudiantesReales(estudiantes) {
    const grid = document.getElementById('estudiantes-grid');
    const loading = document.getElementById('loading-estudiantes');

    if (loading) loading.style.display = 'none';

    if (!estudiantes || estudiantes.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-users" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p style="font-size: 1.2rem;">Aún no hay estudiantes registrados.</p>
                <p>¡Sé el primero en unirte!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';

    estudiantes.forEach((estudiante, index) => {
        const estudianteCard = document.createElement('div');
        estudianteCard.classList.add('estudiante-card');
        estudianteCard.style.animation = 'fadeIn 0.5s ease';
        estudianteCard.style.animationDelay = `${index * 0.1}s`;

        estudianteCard.innerHTML = `
            <img src="${estudiante.foto_url}" 
                 alt="${estudiante.nombre_completo}" 
                 class="estudiante-avatar"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(estudiante.nombre_completo)}&background=3b82f6&color=fff&size=200'">
            <h3 class="estudiante-name">${estudiante.nombre_completo}</h3>
            <p class="estudiante-date">
                <i class="fa-solid fa-calendar-check"></i> 
                ${new Date(estudiante.created_at).toLocaleDateString('es-ES')}
            </p>
        `;

        grid.appendChild(estudianteCard);
    });
}

function inicializarRealtimeEstudiantes() {
    if (!supabaseClient) return;

    if (estudiantesListener) {
        supabaseClient.removeChannel(estudiantesListener);
    }

    estudiantesListener = supabaseClient
        .channel('estudiantes-realtime')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'estudiantes'
            },
            (payload) => {
                cargarEstudiantes();
            }
        )
        .subscribe();
}

function renderEstudiantes() {
    if (supabaseClient) {
        cargarEstudiantes();
        inicializarRealtimeEstudiantes();
    } else {
        setTimeout(() => {
            if (supabaseClient) {
                cargarEstudiantes();
                inicializarRealtimeEstudiantes();
            } else {
                const grid = document.getElementById('estudiantes-grid');
                grid.innerHTML = `
                    <p style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 2rem;">
                        Error de conexión con Supabase.
                    </p>
                `;
            }
        }, 1500);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const supabaseReady = initSupabase();

    const checkbox = document.getElementById('aceptoTerminos');
    if (checkbox) {
        checkbox.addEventListener('change', function() {
            const formRegistro = document.getElementById('form-registro');
            const terminosContainer = document.querySelector('.terminos-container');

            if (this.checked) {
                terminosContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                terminosContainer.style.opacity = '0';
                terminosContainer.style.transform = 'translateY(-20px)';

                setTimeout(() => {
                    terminosContainer.style.display = 'none';
                    formRegistro.style.display = 'block';
                    formRegistro.style.opacity = '0';
                    formRegistro.style.transform = 'translateY(20px)';

                    setTimeout(() => {
                        formRegistro.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        formRegistro.style.opacity = '1';
                        formRegistro.style.transform = 'translateY(0)';
                    }, 10);
                }, 300);
            } else {
                formRegistro.style.opacity = '0';
                formRegistro.style.transform = 'translateY(20px)';

                setTimeout(() => {
                    formRegistro.style.display = 'none';
                    terminosContainer.style.display = 'block';
                    terminosContainer.style.opacity = '0';
                    terminosContainer.style.transform = 'translateY(-20px)';

                    setTimeout(() => {
                        terminosContainer.style.opacity = '1';
                        terminosContainer.style.transform = 'translateY(0)';
                    }, 10);
                }, 300);
            }
        });
    }

    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('click', function(e) {
            if (!e.target.closest('.btn-change-photo')) {
                document.getElementById('fotoInput').click();
            }
        });
    }
});

// ============================================
// FUNCIONES DEL SIDEBAR
// ============================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    sidebar.classList.toggle('open');

    if (window.innerWidth <= 768) {
        overlay.classList.toggle('active');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}

function switchTab(tab) {
    currentTab = tab;
    showingFinalizados = false;

    if (window.innerWidth <= 768) {
        closeSidebar();
    }

    sectionRepositorio.style.display = 'none';
    sectionTrabajos.style.display = 'none';
    sectionRecursos.style.display = 'none';
    sectionDocentes.style.display = 'none';
    sectionEstudiantes.style.display = 'none';

    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const searchInputRepo = document.getElementById('searchInputRepositorio');
    const searchInputRec = document.getElementById('searchInputRecursos');
    if (searchInputRepo) searchInputRepo.value = '';
    if (searchInputRec) searchInputRec.value = '';

    if (tab === 'repositorio') {
        sectionRepositorio.style.display = 'block';
        document.getElementById('tab-repositorio').classList.add('active');
        renderFiles();
    } else if (tab === 'trabajos') {
        sectionTrabajos.style.display = 'block';
        document.getElementById('tab-trabajos').classList.add('active');
        trabajosPendientesSection.style.display = 'block';
        trabajosFinalizadosSection.style.display = 'none';
        const btn = document.getElementById('btn-trabajos-finalizados');
        if (btn) {
            const btnIcon = btn.querySelector('i');
            const btnTextSpan = document.getElementById('btn-trabajos-text');
            if (btnTextSpan) btnTextSpan.textContent = 'Ver trabajos finalizados';
            if (btnIcon) btnIcon.className = 'fa-solid fa-check-circle';
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