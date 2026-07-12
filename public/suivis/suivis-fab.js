// ═════════════════════════════════════════════════════════════════
// BOUTON FLOTTANT "Suivis en cours" — additif
// ═════════════════════════════════════════════════════════════════
// Même mécanique que le bouton flottant Actions (déplaçable
// verticalement, aimanté aux bords) : réutilise les fonctions globales
// getFabVerticalBounds()/applyFabPosition() déjà exposées par actions.js,
// sans dupliquer leur logique. Position sauvegardée sous une clé dédiée
// et côté opposé par défaut, pour ne jamais se superposer au FAB Actions.
// Appui court = ouvre la liste des campagnes en cours (toutes catégories).
// Visibilité pilotée comme n'importe quel élément d'accueil via l'id
// "suivis-fab" ajouté au registre HOME_ELEMENTS (app.js).
// ═════════════════════════════════════════════════════════════════
const SUIVIS_FAB_POS_KEY = 'gmao_suivis_fab_pos';
const SUIVIS_FAB_DRAG_THRESHOLD = 10;

function readSuivisFabPosition(){
    let pos = {side:'left', ratio:0.35};
    try {
        const stored = JSON.parse(localStorage.getItem(SUIVIS_FAB_POS_KEY) || '{}');
        pos = Object.assign(pos, stored);
    } catch(e){ /* valeurs par défaut conservées */ }
    return pos;
}
function saveSuivisFabPosition(side, ratio){
    localStorage.setItem(SUIVIS_FAB_POS_KEY, JSON.stringify({side, ratio}));
}
function clampSuivisFabToViewport(fab){
    const pos = readSuivisFabPosition();
    applyFabPosition(fab, pos.side, pos.ratio);
}
function initSuivisFab(){
    const fab = document.getElementById('suivis-fab');
    if(!fab || typeof applyFabPosition !== 'function' || typeof getFabVerticalBounds !== 'function') return;
    applyFabPosition(fab, readSuivisFabPosition().side, readSuivisFabPosition().ratio);

    let dragging = false, moved = false, startX = 0, startY = 0, startTop = 0;

    fab.addEventListener('pointerdown', function(e){
        dragging = false; moved = false;
        startX = e.clientX; startY = e.clientY;
        startTop = fab.getBoundingClientRect().top;
        try { fab.setPointerCapture(e.pointerId); } catch(err){}
    });

    fab.addEventListener('pointermove', function(e){
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if(!dragging && Math.hypot(dx, dy) > SUIVIS_FAB_DRAG_THRESHOLD){
            dragging = true; moved = true;
            fab.classList.add('dragging');
        }
        if(dragging){
            const bounds = getFabVerticalBounds();
            const h = fab.offsetHeight || 56;
            let newTop = startTop + dy;
            newTop = Math.max(bounds.top, Math.min(bounds.bottom - h, newTop));
            fab.style.top = newTop + 'px';
            fab.style.bottom = 'auto';
            const side = e.clientX > window.innerWidth/2 ? 'right' : 'left';
            fab.style.left  = side === 'left'  ? '12px' : 'auto';
            fab.style.right = side === 'right' ? '12px' : 'auto';
        }
    });

    function endDrag(e){
        fab.classList.remove('dragging');
        if(dragging){
            const bounds = getFabVerticalBounds();
            const h = fab.offsetHeight || 56;
            const top = parseFloat(fab.style.top) || bounds.top;
            const range = Math.max(1, (bounds.bottom - bounds.top - h));
            const ratio = Math.min(1, Math.max(0, (top - bounds.top) / range));
            const side = e.clientX > window.innerWidth/2 ? 'right' : 'left';
            applyFabPosition(fab, side, ratio);
            saveSuivisFabPosition(side, ratio);
        } else if(!moved){
            if(typeof window.ouvrirSuivisEnCours === 'function') window.ouvrirSuivisEnCours();
        }
        dragging = false; moved = false;
    }
    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', function(){ fab.classList.remove('dragging'); dragging=false; moved=false; });

    window.addEventListener('resize', function(){ clampSuivisFabToViewport(fab); });
    window.addEventListener('orientationchange', function(){ setTimeout(function(){ clampSuivisFabToViewport(fab); }, 300); });
}

function updateSuivisFabBadge(){
    const badge = document.getElementById('suivis-fab-badge');
    if(!badge || !window.SuivisEngine) return;
    const n = SuivisEngine.listCampagnesInachevees().length;
    if(n > 0){
        badge.style.display = 'flex';
        badge.textContent = n > 99 ? '99+' : String(n);
    } else {
        badge.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function(){
    initSuivisFab();
    updateSuivisFabBadge();
});
