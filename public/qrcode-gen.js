// ═════════════════════════════════════════════════════════════════
// GÉNÉRATEUR DE QR CODE
// ═════════════════════════════════════════════════════════════════
// Utilise la librairie "qrcode" (davidshimjs/soldair, chargée via CDN dans
// index.html) pour l'encodage : rendu canvas + export SVG natif, options
// taille / couleurs / marge / niveau de correction d'erreur directement
// supportées par la librairie. Le logo central est composé par-dessus au
// moment du rendu canvas (jamais dans le flux d'encodage lui-même).
// ═════════════════════════════════════════════════════════════════

let qrGenLogoImage = null; // Image() chargée, ou null si aucun logo choisi

function openQrGeneratorModal(){
    if(!document.getElementById('qrgen-content').value){
        document.getElementById('qrgen-content').value = location.origin + location.pathname;
    }
    safeAddClass('qrGeneratorModal','active');
    renderQrPreview();
}

function getQrGenOptions(){
    return {
        text:   document.getElementById('qrgen-content').value || ' ',
        size:   parseInt(document.getElementById('qrgen-size').value, 10) || 280,
        margin: parseInt(document.getElementById('qrgen-margin').value, 10),
        fg:     document.getElementById('qrgen-fg').value || '#0f172a',
        bg:     document.getElementById('qrgen-bg').value || '#ffffff',
        ecl:    document.getElementById('qrgen-ecl').value || 'M'
    };
}

function renderQrPreview(){
    if(typeof QRCode === 'undefined'){
        showAlarmToast('⚠️','Générateur indisponible','La librairie de génération QR n\'a pas pu être chargée (connexion internet requise au premier chargement).','warning',6000);
        return;
    }
    const opts = getQrGenOptions();
    const canvas = document.getElementById('qrgen-canvas');
    QRCode.toCanvas(canvas, opts.text, {
        width: opts.size,
        margin: opts.margin,
        errorCorrectionLevel: opts.ecl,
        color: { dark: opts.fg, light: opts.bg }
    }, function(err){
        if(err){ console.warn('[QRGen] erreur de rendu :', err); return; }
        if(qrGenLogoImage) drawQrGenLogo(canvas, opts);
    });
}

function drawQrGenLogo(canvas, opts){
    const ctx = canvas.getContext('2d');
    const logoSize = Math.round(canvas.width * 0.22);
    const cx = (canvas.width - logoSize) / 2;
    const cy = (canvas.height - logoSize) / 2;
    const pad = Math.round(logoSize * 0.12);
    // Fond de sécurité derrière le logo, pour garantir la lisibilité du QR autour
    ctx.fillStyle = opts.bg;
    ctx.fillRect(cx - pad, cy - pad, logoSize + pad*2, logoSize + pad*2);
    ctx.drawImage(qrGenLogoImage, cx, cy, logoSize, logoSize);
}

function onQrGenLogoChosen(fileList){
    const file = (fileList||[])[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(){
        const img = new Image();
        img.onload = function(){
            qrGenLogoImage = img;
            // Un logo réduit fortement la lisibilité : on force le niveau de
            // correction d'erreur maximal pour compenser (modifiable ensuite).
            document.getElementById('qrgen-ecl').value = 'H';
            renderQrPreview();
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
    document.getElementById('qrgen-logo-input').value = '';
}
function clearQrGenLogo(){
    qrGenLogoImage = null;
    renderQrPreview();
}

// ── Exports ─────────────────────────────────────────────────────
function exportQrGenPng(){
    const canvas = document.getElementById('qrgen-canvas');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'qrcode.png';
    document.body.appendChild(a); a.click(); a.remove();
}
function exportQrGenSvg(){
    if(typeof QRCode === 'undefined') return;
    const opts = getQrGenOptions();
    QRCode.toString(opts.text, {
        type: 'svg', margin: opts.margin, errorCorrectionLevel: opts.ecl,
        color: { dark: opts.fg, light: opts.bg }
    }, function(err, svgString){
        if(err){ showAlarmToast('⚠️','Export SVG impossible', err.message||'Erreur inconnue.', 'warning', 5000); return; }
        const blob = new Blob([svgString], {type:'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'qrcode.svg';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 4000);
    });
}
// Export PDF : réutilise le mécanisme déjà en place dans l'application pour les
// procédures — impression navigateur vers un gabarit dédié, l'utilisateur
// choisit "Enregistrer en PDF" dans la boîte de dialogue d'impression.
function buildQrGenPrintArea(){
    const canvas = document.getElementById('qrgen-canvas');
    if(!canvas) return;
    safeHTML('qrgen-print-area',
        `<img src="${canvas.toDataURL('image/png')}" style="max-width:100%;">`);
}
function exportQrGenPdf(){
    buildQrGenPrintArea();
    showAlarmToast('📄','Export PDF','Choisissez "Enregistrer en PDF" dans la fenêtre d\'impression qui s\'ouvre.','info',5000);
    window.print();
}
function printQrGen(){
    buildQrGenPrintArea();
    window.print();
}
