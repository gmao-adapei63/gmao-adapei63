// ───────────────────────────────────────────────────────────────────────────
// GESTURE MANAGER — Architecture professionnelle de gestion des gestes tactiles
// Chaque zone (Header, Dashboard, Missions, Navbar) est totalement indépendante
// ───────────────────────────────────────────────────────────────────────────

class GestureManager {
    constructor() {
        this.zones = new Map();
        this.enabled = true;
    }

    registerZone(name, config) {
        this.zones.set(name, new GestureZone(name, config));
    }

    getZone(name) {
        return this.zones.get(name);
    }

    disable() {
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
    }
}

class GestureZone {
    constructor(name, config) {
        this.name = name;
        this.element = config.element;
        this.handlers = config.handlers || {};
        
        // Configuration des gestes autorisés
        this.allowClick = config.allowClick !== false;
        this.allowSwipeHorizontal = config.allowSwipeHorizontal === true;
        this.allowSwipeVertical = config.allowSwipeVertical === true;
        this.allowLongPress = config.allowLongPress === true;
        
        // Seuils de détection (px)
        this.clickThreshold = config.clickThreshold !== undefined ? config.clickThreshold : 10;
        this.swipeThreshold = config.swipeThreshold !== undefined ? config.swipeThreshold : 50;
        this.longPressDelay = config.longPressDelay !== undefined ? config.longPressDelay : 400;
        
        // État tactile local
        this.touchState = {
            startX: 0,
            startY: 0,
            startTime: 0,
            currentX: 0,
            currentY: 0,
            longPressTimer: null,
            isTouching: false
        };
        
        // CSS configuré pour cette zone
        this.touchAction = config.touchAction || 'auto';
        this.pointerEvents = config.pointerEvents !== false;
        this.overflowX = config.overflowX || 'auto';
        this.overflowY = config.overflowY || 'auto';
        
        this._setupStyles();
        this._attachListeners();
    }

    _setupStyles() {
        if (!this.element) return;
        this.element.style.touchAction = this.touchAction;
        this.element.style.pointerEvents = this.pointerEvents ? 'auto' : 'none';
        if (this.overflowX) this.element.style.overflowX = this.overflowX;
        if (this.overflowY) this.element.style.overflowY = this.overflowY;
    }

    _attachListeners() {
        if (!this.element) return;
        
        this.element.addEventListener('touchstart', e => this._onTouchStart(e), { passive: true });
        this.element.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
        this.element.addEventListener('touchend', e => this._onTouchEnd(e), { passive: true });
        this.element.addEventListener('touchcancel', e => this._onTouchCancel(e), { passive: true });
    }

    _onTouchStart(e) {
        // Ne rien faire si le geste a commencé sur un contrôle interactif
        if (this._isInteractiveElement(e.target)) return;
        
        this.touchState.startX = e.touches[0].clientX;
        this.touchState.startY = e.touches[0].clientY;
        this.touchState.currentX = this.touchState.startX;
        this.touchState.currentY = this.touchState.startY;
        this.touchState.startTime = Date.now();
        this.touchState.isTouching = true;
        
        // Démarrer le timer pour long-press si autorisé
        if (this.allowLongPress && this.handlers.onLongPress) {
            this.touchState.longPressTimer = setTimeout(() => {
                if (this.touchState.isTouching) {
                    this.handlers.onLongPress();
                }
            }, this.longPressDelay);
        }
    }

    _onTouchMove(e) {
        if (!this.touchState.isTouching) return;
        
        this.touchState.currentX = e.touches[0].clientX;
        this.touchState.currentY = e.touches[0].clientY;
        
        const dx = this.touchState.currentX - this.touchState.startX;
        const dy = this.touchState.currentY - this.touchState.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Annuler long-press si mouvement significatif
        if (distance > 8) {
            this._clearLongPressTimer();
        }
    }

    _onTouchEnd(e) {
        if (!this.touchState.isTouching) return;
        
        const dx = this.touchState.currentX - this.touchState.startX;
        const dy = this.touchState.currentY - this.touchState.startY;
        const dt = Date.now() - this.touchState.startTime;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this._clearLongPressTimer();
        this.touchState.isTouching = false;
        
        // Déterminer le type de geste
        if (distance < this.clickThreshold && dt < 300) {
            // CUC
            if (this.allowClick && this.handlers.onClick) {
                this.handlers.onClick(e);
            }
        } else if (distance >= this.swipeThreshold) {
            // SWIPE
            if (Math.abs(dx) > Math.abs(dy)) {
                // Swipe horizontal
                if (this.allowSwipeHorizontal && this.handlers.onSwipeHorizontal) {
                    const direction = dx > 0 ? 'right' : 'left';
                    this.handlers.onSwipeHorizontal(direction, dx);
                }
            } else {
                // Swipe vertical
                if (this.allowSwipeVertical && this.handlers.onSwipeVertical) {
                    const direction = dy > 0 ? 'down' : 'up';
                    this.handlers.onSwipeVertical(direction, dy);
                }
            }
        }
    }

    _onTouchCancel(e) {
        this._clearLongPressTimer();
        this.touchState.isTouching = false;
    }

    _clearLongPressTimer() {
        if (this.touchState.longPressTimer) {
            clearTimeout(this.touchState.longPressTimer);
            this.touchState.longPressTimer = null;
        }
    }

    _isInteractiveElement(el) {
        // Ne pas intercepter les gestes sur les éléments interactifs
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            return true;
        }
        if (el.tagName === 'BUTTON' || el.closest('button')) {
            return true;
        }
        if (el.closest('a')) {
            return true;
        }
        return false;
    }
}

// Instanciation globale
const gestureManager = new GestureManager();

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GestureManager, gestureManager };
}
