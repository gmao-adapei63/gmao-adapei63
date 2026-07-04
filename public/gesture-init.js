// ───────────────────────────────────────────────────────────────────────────
// GESTURE INITIALIZATION — Remplace initSwipeNav() avec architecture multi-zones
// À charger APRÈS gesture-manager.js et remplace l'appel à initSwipeNav()
// ───────────────────────────────────────────────────────────────────────────

function initializeGestureZones() {
    if (typeof gestureManager === 'undefined') {
        console.error('GestureManager non chargé. Vérifiez que gesture-manager.js est inclus avant gesture-init.js');
        return;
    }

    // ─────────────────────────────────────────────────────────────
    // ZONE 1 — HEADER (Pas de swipe, clicks uniquement)
    // ─────────────────────────────────────────────────────────────
    gestureManager.registerZone('header', {
        element: document.querySelector('.header'),
        allowClick: true,
        allowSwipeHorizontal: false,
        allowSwipeVertical: false,
        allowLongPress: false,
        touchAction: 'manipulation',
        handlers: {
            onClick: (data) => {
                // Les clics sont gérés par les onclick des boutons du header
                // Cette zone empêche juste les swipes d'être propagés
            }
        }
    });

    // ─────────────────────────────────────────────────────────────
    // ZONE 2 — DASHBOARD TILES (Pas de swipe, clicks uniquement)
    // ─────────────────────────────────────────────────────────────
    gestureManager.registerZone('dashboard', {
        element: document.getElementById('home-tiles'),
        allowClick: true,
        allowSwipeHorizontal: false,
        allowSwipeVertical: false,
        allowLongPress: false,
        touchAction: 'manipulation',
        handlers: {
            onClick: (data) => {
                // Les clics sont gérés par les onclick des tuiles
            }
        }
    });

    // ─────────────────────────────────────────────────────────────
    // ZONE 3 — TASK LIST (Swipe horizontal pour changer les dates)
    // ─────────────────────────────────────────────────────────────
    gestureManager.registerZone('task-list', {
        element: document.getElementById('task-list-container'),
        allowClick: true,
        allowSwipeHorizontal: true,
        allowSwipeVertical: false,
        allowLongPress: true,
        clickThreshold: 10,
        swipeThreshold: 50,
        longPressDelay: 400,
        touchAction: 'pan-y',
        handlers: {
            onClick: (data) => {
                // Les clics standard sont gérés par les event handlers des cartes
            },
            onSwipeHorizontal: (swipeData) => {
                // Swipe gauche = jour suivant, Swipe droite = jour précédent
                const cur = new Date(activeDate + 'T12:00:00');
                const dest = new Date(cur);
                
                if (swipeData.direction === 'left') {
                    dest.setDate(dest.getDate() + 1); // demain
                } else if (swipeData.direction === 'right') {
                    dest.setDate(dest.getDate() - 1); // hier
                }
                
                const destStr = dest.toISOString().split('T')[0];
                document.getElementById('system-date').value = destStr;
                loadDayData(destStr);
                
                // Feedback haptique léger
                if (navigator.vibrate) navigator.vibrate(15);
            },
            onLongPress: (data) => {
                // Futur support : drag & drop ou actions contextuelles
            }
        }
    });

    // ─────────────────────────────────────────────────────────────
    // ZONE 4 — BOTTOM NAVBAR (Swipe horizontal uniquement pour scroll)
    // ─────────────────────────────────────────────────────────────
    gestureManager.registerZone('navbar', {
        element: document.getElementById('bottom-nav'),
        allowClick: true,
        allowSwipeHorizontal: true,
        allowSwipeVertical: false,
        allowLongPress: false,
        clickThreshold: 10,
        swipeThreshold: 50,
        touchAction: 'pan-x pan-y',
        overflowX: 'auto',
        overflowY: 'hidden',
        handlers: {
            onClick: (data) => {
                // Les clics sont gérés par les onclick des nav-items
            },
            onSwipeHorizontal: (swipeData) => {
                // Le swipe de la navbar ne doit que faire scroller les icônes
                // Si la navbar n'a pas d'overflow, rien ne se passe (comportement normal)
                const navbar = document.getElementById('bottom-nav');
                const currentScroll = navbar.scrollLeft;
                const scrollAmount = swipeData.distance * 0.5; // 50% de la distance du swipe
                
                if (swipeData.direction === 'left') {
                    navbar.scrollLeft = currentScroll + scrollAmount;
                } else if (swipeData.direction === 'right') {
                    navbar.scrollLeft = currentScroll - scrollAmount;
                }
            }
        }
    });

    // ─────────────────────────────────────────────────────────────
    // ZONE 5 — MAIN CONTENT (Protection contre les swipes accidentels)
    // ─────────────────────────────────────────────────────────────
    gestureManager.registerZone('main-content', {
        element: document.querySelector('.main-content'),
        allowClick: true,
        allowSwipeHorizontal: false,
        allowSwipeVertical: false,
        allowLongPress: false,
        touchAction: 'pan-y',
        handlers: {
            onClick: (data) => {
                // Accepte les clics mais bloque les swipes
            }
        }
    });

    console.log('✅ Gesture zones initialisées avec succès');
    console.log('Zones enregistrées:', Array.from(gestureManager.zones.keys()));
}

// Fonction de dépannage : afficher l'état des gestes
function debugGestures() {
    console.group('🎯 Gesture Manager Debug');
    console.log('Gestionnaire actif:', gestureManager.enabled);
    console.log('Zones enregistrées:');
    gestureManager.zones.forEach((zone, name) => {
        console.log(`  • ${name}: actif=${zone.enabled}, swipeH=${zone.allowSwipeHorizontal}, swipeV=${zone.allowSwipeVertical}, click=${zone.allowClick}`);
    });
    console.groupEnd();
}

// Fonction pour activer/désactiver les gestes par zone
function setGestureZoneEnabled(zoneName, enabled) {
    const zone = gestureManager.getZone(zoneName);
    if (zone) {
        enabled ? zone.enable() : zone.disable();
        console.log(`Zone "${zoneName}" ${enabled ? 'activée' : 'désactivée'}`);
    }
}

// Fonction pour désactiver temporairement tous les gestes (ex: lors d'une modale)
function suspendGestures() {
    gestureManager.disable();
    console.log('⏸️  Tous les gestes sont suspendus');
}

function resumeGestures() {
    gestureManager.enable();
    console.log('▶️  Tous les gestes sont réactivés');
}
