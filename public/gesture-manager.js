// ───────────────────────────────────────────────────────────────────────────
// GESTURE MANAGER — Architecture professionnelle de gestion des gestes tactiles
// Chaque zone (Header, Dashboard, Missions, Navbar) est totalement indépendante
// Support complet : click, swipe (H/V), long-press, pinch-to-zoom, multi-touch
// ───────────────────────────────────────────────────────────────────────────

class GestureManager {
    constructor() {
        this.zones = new Map();
        this.enabled = true;
        this.globalListeners = new Map();
    }

    registerZone(name, config) {
        this.zones.set(name, new GestureZone(name, config));
        return this.zones.get(name);
    }

    getZone(name) {
        return this.zones.get(name);
    }

    unregisterZone(name) {
        const zone = this.zones.get(name);
        if (zone) zone.destroy();
        this.zones.delete(name);
    }

    disable() {
        this.enabled = false;
        this.zones.forEach(zone => zone.disable());
    }

    enable() {
        this.enabled = true;
        this.zones.forEach(zone => zone.enable());
    }

    disableZone(name) {
        const zone = this.zones.get(name);
        if (zone) zone.disable();
    }

    enableZone(name) {
        const zone = this.zones.get(name);
        if (zone) zone.enable();
    }
}

class GestureZone {
    constructor(name, config) {
        this.name = name;
        this.element = config.element;
        this.handlers = config.handlers || {};
        this.enabled = true;
        
        // Configuration des gestes autorisés
        this.allowClick = config.allowClick !== false;
        this.allowSwipeHorizontal = config.allowSwipeHorizontal === true;
        this.allowSwipeVertical = config.allowSwipeVertical === true;
        this.allowLongPress = config.allowLongPress === true;
        this.allowPinch = config.allowPinch === true;
        this.allowDoubleTap = config.allowDoubleTap === true;
        
        // Seuils de détection (px)
        this.clickThreshold = config.clickThreshold !== undefined ? config.clickThreshold : 10;
        this.swipeThreshold = config.swipeThreshold !== undefined ? config.swipeThreshold : 50;
        this.longPressDelay = config.longPressDelay !== undefined ? config.longPressDelay : 400;
        this.pinchThreshold = config.pinchThreshold !== undefined ? config.pinchThreshold : 0.1;
        this.doubleTapDelay = config.doubleTapDelay !== undefined ? config.doubleTapDelay : 300;
        
        // État tactile local
        this.touchState = {
            startX: 0,
            startY: 0,
            startTime: 0,
            currentX: 0,
            currentY: 0,
            longPressTimer: null,
            doubleTapTimer: null,
            lastTapTime: 0,
            isTouching: false,
            touchCount: 0,
            // Multi-touch
            touches: [],
            startDistance: 0,
            startScale: 1.0,
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
        
        this._boundTouchStart = e => this._onTouchStart(e);
        this._boundTouchMove = e => this._onTouchMove(e);
        this._boundTouchEnd = e => this._onTouchEnd(e);
        this._boundTouchCancel = e => this._onTouchCancel(e);
        
        this.element.addEventListener('touchstart', this._boundTouchStart, { passive: true });
        this.element.addEventListener('touchmove', this._boundTouchMove, { passive: false });
        this.element.addEventListener('touchend', this._boundTouchEnd, { passive: true });
        this.element.addEventListener('touchcancel', this._boundTouchCancel, { passive: true });
    }

    _onTouchStart(e) {
        if (!this.enabled) return;
        if (this._isInteractiveElement(e.target)) return;
        
        this.touchState.touchCount = e.touches.length;
        
        if (e.touches.length === 1) {
            // Single touch
            this.touchState.startX = e.touches[0].clientX;
            this.touchState.startY = e.touches[0].clientY;
            this.touchState.currentX = this.touchState.startX;
            this.touchState.currentY = this.touchState.startY;
            this.touchState.startTime = Date.now();
            this.touchState.isTouching = true;
            
            // Démarrer le timer pour long-press si autorisé
            if (this.allowLongPress && this.handlers.onLongPress) {
                this.touchState.longPressTimer = setTimeout(() => {
                    if (this.touchState.isTouching && this.touchState.touchCount === 1) {
                        this.handlers.onLongPress({
                            x: this.touchState.startX,
                            y: this.touchState.startY
                        });
                    }
                }, this.longPressDelay);
            }
        } else if (e.touches.length === 2 && this.allowPinch && this.handlers.onPinchStart) {
            // Pinch start
            this._clearLongPressTimer();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.touchState.startDistance = this._getDistance(touch1, touch2);
            this.touchState.startScale = 1.0;
            this.touchState.touches = [
                { x: touch1.clientX, y: touch1.clientY },
                { x: touch2.clientX, y: touch2.clientY }
            ];
            this.handlers.onPinchStart({
                distance: this.touchState.startDistance,
                touches: this.touchState.touches
            });
        }
    }

    _onTouchMove(e) {
        if (!this.enabled) return;
        if (!this.touchState.isTouching && e.touches.length < 2) return;
        
        if (e.touches.length === 1) {
            // Single touch move
            this.touchState.currentX = e.touches[0].clientX;
            this.touchState.currentY = e.touches[0].clientY;
            
            const dx = this.touchState.currentX - this.touchState.startX;
            const dy = this.touchState.currentY - this.touchState.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Annuler long-press si mouvement significatif
            if (distance > 8) {
                this._clearLongPressTimer();
            }
        } else if (e.touches.length === 2 && this.allowPinch) {
            // Pinch move
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = this._getDistance(touch1, touch2);
            const scale = currentDistance / (this.touchState.startDistance || currentDistance);
            
            this.touchState.touches = [
                { x: touch1.clientX, y: touch1.clientY },
                { x: touch2.clientX, y: touch2.clientY }
            ];
            
            if (this.handlers.onPinchMove) {
                this.handlers.onPinchMove({
                    scale: scale,
                    distance: currentDistance,
                    delta: currentDistance - this.touchState.startDistance,
                    touches: this.touchState.touches
                });
            }
        }
    }

    _onTouchEnd(e) {
        if (!this.enabled) return;
        
        if (e.touches.length === 0 && this.touchState.isTouching) {
            // Single touch end
            const dx = this.touchState.currentX - this.touchState.startX;
            const dy = this.touchState.currentY - this.touchState.startY;
            const dt = Date.now() - this.touchState.startTime;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            this._clearLongPressTimer();
            this.touchState.isTouching = false;
            
            // Déterminer le type de geste
            if (distance < this.clickThreshold && dt < 300) {
                // CLICK ou DOUBLE-TAP
                if (this.allowDoubleTap && this.handlers.onDoubleTap) {
                    const now = Date.now();
                    if (now - this.touchState.lastTapTime < this.doubleTapDelay) {
                        this.handlers.onDoubleTap({
                            x: this.touchState.startX,
                            y: this.touchState.startY
                        });
                        this.touchState.lastTapTime = 0; // Reset
                        return;
                    }
                    this.touchState.lastTapTime = now;
                }
                
                if (this.allowClick && this.handlers.onClick) {
                    this.handlers.onClick({
                        x: this.touchState.startX,
                        y: this.touchState.startY
                    });
                }
            } else if (distance >= this.swipeThreshold) {
                // SWIPE
                if (Math.abs(dx) > Math.abs(dy)) {
                    // Swipe horizontal
                    if (this.allowSwipeHorizontal && this.handlers.onSwipeHorizontal) {
                        const direction = dx > 0 ? 'right' : 'left';
                        this.handlers.onSwipeHorizontal({
                            direction: direction,
                            distance: Math.abs(dx),
                            velocity: Math.abs(dx) / dt
                        });
                    }
                } else {
                    // Swipe vertical
                    if (this.allowSwipeVertical && this.handlers.onSwipeVertical) {
                        const direction = dy > 0 ? 'down' : 'up';
                        this.handlers.onSwipeVertical({
                            direction: direction,
                            distance: Math.abs(dy),
                            velocity: Math.abs(dy) / dt
                        });
                    }
                }
            }
        } else if (e.touches.length === 0 && this.allowPinch && this.handlers.onPinchEnd) {
            // Pinch end
            this.handlers.onPinchEnd({
                finalScale: this.touchState.startScale,
                touches: this.touchState.touches
            });
            this.touchState.touches = [];
        }
    }

    _onTouchCancel(e) {
        this._clearLongPressTimer();
        this.touchState.isTouching = false;
        this.touchState.touches = [];
    }

    _clearLongPressTimer() {
        if (this.touchState.longPressTimer) {
            clearTimeout(this.touchState.longPressTimer);
            this.touchState.longPressTimer = null;
        }
    }

    _getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _isInteractiveElement(el) {
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

    disable() {
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
    }

    destroy() {
        if (!this.element) return;
        this._clearLongPressTimer();
        this.element.removeEventListener('touchstart', this._boundTouchStart);
        this.element.removeEventListener('touchmove', this._boundTouchMove);
        this.element.removeEventListener('touchend', this._boundTouchEnd);
        this.element.removeEventListener('touchcancel', this._boundTouchCancel);
    }
}

// Instanciation globale
const gestureManager = new GestureManager();

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GestureManager, gestureManager };
}