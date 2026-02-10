// ============================================
// SERVICE WORKER PARA NOTIFICACIONES PUSH
// ============================================
// Este archivo DEBE estar en la raíz de tu sitio web
// Nombre del archivo: firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ⚠️ REEMPLAZA CON TU CONFIGURACIÓN DE FIREBASE
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

const messaging = firebase.messaging();

// Manejar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification.title || 'EduSpace';
    const notificationOptions = {
        body: payload.notification.body || 'Tienes una nueva actualización',
        icon: payload.notification.icon || '/icon-192.png', // Crea un icono de 192x192px
        badge: '/badge-72.png', // Crea un badge de 72x72px
        tag: payload.data?.tag || 'eduspace-notification',
        requireInteraction: true,
        data: {
            url: payload.data?.url || '/',
            type: payload.data?.type || 'general'
        },
        actions: [
            {
                action: 'open',
                title: 'Ver ahora'
            },
            {
                action: 'close',
                title: 'Cerrar'
            }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar click en la notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received.');
    
    event.notification.close();
    
    if (event.action === 'open') {
        const urlToOpen = event.notification.data.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // Si ya hay una ventana abierta, enfocarla
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no, abrir nueva ventana
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// Evento de instalación del service worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting();
});

// Evento de activación
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(clients.claim());
});
