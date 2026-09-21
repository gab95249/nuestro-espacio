// Estado global
let momentos = [];
let momentosAgrupados = []; // Agrupados por fecha
let momentosAgrupados_full = []; // Copia completa sin filtrar
let miniCarrouselIndex = {}; // Índice de mini-carrusel por fecha
let selectedYear = null; // Año seleccionado para filtrar
let tipoActual = 'foto'; // Qué se está creando en el formulario: 'foto' o 'carta'
let cartaAbierta = null; // El sobre que está abierto ahora mismo

// Constantes
const maxClicks = 5;
const minFontSize = 100;
const maxFontSize = 180;
let heartClickCount = 0;

// Pantallas
const splashScreen = document.getElementById('splash-screen');
const mainScreen = document.getElementById('main-screen');

// DOM - Splash
const heart = document.getElementById('heart');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const hint = document.querySelector('.hint');

// DOM - Main
const userBadge = document.getElementById('user-badge');
const uploadForm = document.getElementById('upload-form');
const momentosCarousel = document.getElementById('momentos-carousel');
const momentCounter = document.getElementById('moment-counter');
const uploadFormContainer = document.getElementById('upload-form-container');
const uploadError = document.getElementById('upload-error');
const uploadSuccess = document.getElementById('upload-success');
const cartaModal = document.getElementById('carta-modal');

// Mini-carousel swipe support (delegated)
document.addEventListener('touchstart', handleMiniCarrouselTouchStart, false);
document.addEventListener('touchmove', handleMiniCarrouselTouchMove, { passive: false });
document.addEventListener('touchend', handleMiniCarrouselTouchEnd, false);

let arrastre = null;

// ==================== LOGOUT ====================
function logout() {
    heartClickCount = 0;
    momentos = [];
    showScreen('splash');
    resetHeart();
}

// ==================== SPLASH SCREEN ====================
function handleHeartClick(event) {
    heartClickCount++;
    if (heartClickCount > maxClicks) heartClickCount = maxClicks;

    // Animación del corazón
    heart.classList.remove('clicked');
    void heart.offsetWidth; // Trigger reflow
    heart.classList.add('clicked');

    // Aumentar tamaño
    const fontSizeIncrease = (heartClickCount / maxClicks) * (maxFontSize - minFontSize);
    heart.style.fontSize = (minFontSize + fontSizeIncrease) + 'px';

    // Actualizar barra
    const progress = (heartClickCount / maxClicks) * 100;
    progressBar.style.width = progress + '%';
    progressPercent.textContent = Math.round(progress);

    // Emoji flotante
    createFloatingEmoji(event);

    // Si se llena completamente
    if (heartClickCount === maxClicks) {
        setTimeout(() => {
            celebrateCompletion();
        }, 300);
    }
}

function createFloatingEmoji(event) {
    const emojis = ['❤️', '🌻', '💕', '✨'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    const trail = document.createElement('div');
    trail.className = 'emoji-trail';
    trail.textContent = randomEmoji;
    trail.style.left = event.clientX + 'px';
    trail.style.top = event.clientY + 'px';

    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 1000);
}

function celebrateCompletion() {
    const heart = document.getElementById('heart');

    // Animación de celebración
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            heart.style.animation = 'none';
            void heart.offsetWidth;
            heart.style.animation = 'pulse 0.6s ease-out';
        }, i * 150);
    }

    // Cambiar mensaje
    setTimeout(() => {
        hint.textContent = '¡100% Amor Cargado! 💕🌻';
        hint.style.opacity = '1';
        hint.style.fontWeight = '600';
        hint.style.color = '#d97706';

        // Ir a main después de 1.5s
        setTimeout(() => {
            showScreen('main');
            cargarMomentos();
            updateUserBadge();
        }, 1500);
    }, 500);
}

function resetHeart() {
    heart.style.fontSize = minFontSize + 'px';
    progressBar.style.width = '0%';
    progressPercent.textContent = '0';
    hint.textContent = 'Dale click al corazón ✨';
    hint.style.fontWeight = '400';
    hint.style.color = '#b45309';
    hint.style.opacity = '0.7';
}

// ==================== MAIN SCREEN ====================
function updateUserBadge() {
    userBadge.textContent = '💕 Nuestro Espacio';
}

// ==================== SUPABASE ====================
// Los recuerdos viven en Supabase, no en el servidor que sirve esta página:
// así sobreviven a cada despliegue y a que el alojamiento se duerma.
const db = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

function urlPublicaDeFoto(ruta) {
    if (!ruta) return '';
    // Las filas antiguas guardaban una ruta local; esas ya vienen listas
    if (/^https?:\/\//i.test(ruta) || ruta.startsWith('/uploads/')) return ruta;
    return db.storage.from(SUPABASE_CONFIG.bucket).getPublicUrl(ruta).data.publicUrl;
}

async function subirFotoAlAlmacen(file) {
    const extension = (file.name.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}${extension}`;

    const { error } = await db.storage
        .from(SUPABASE_CONFIG.bucket)
        .upload(nombre, file, { contentType: file.type || 'image/jpeg', upsert: false });

    if (error) throw new Error(`No se pudo guardar la foto: ${error.message}`);
    return nombre;
}

function cargarMomentos() {
    db.from(SUPABASE_CONFIG.tabla)
        .select('*')
        .order('fecha_recuerdo', { ascending: false })
        .then(({ data, error }) => {
            if (error) throw error;

            momentos = (data || []).map(fila => ({
                ...fila,
                foto_url: urlPublicaDeFoto(fila.foto_url)
            }));

            agruparMomentosPorFecha();
            mostrarYears();
            renderCarousel();
        })
        .catch(err => {
            console.error('Error cargando momentos:', err);
            momentosCarousel.innerHTML = `<div class="album-vacio"><p>No se pudieron cargar los recuerdos. Revisa la conexión.</p></div>`;
        });
}

// Lee el año desde "YYYY-MM-DD" sin pasar por Date, que interpreta la
// fecha como UTC y puede devolver el año anterior en husos negativos.
function getYear(fechaStr) {
    const match = String(fechaStr || '').match(/^(\d{4})/);
    return match ? parseInt(match[1], 10) : new Date(fechaStr).getFullYear();
}

function mostrarYears() {
    const yearsContainer = document.getElementById('years-container');
    if (!yearsContainer) return;

    if (momentos.length === 0) {
        yearsContainer.innerHTML = '';
        return;
    }

    const years = new Set();
    momentos.forEach(momento => {
        years.add(getYear(momento.fecha_recuerdo || momento.fecha));
    });

    const todos = `<span class="year-badge${selectedYear === null ? ' active' : ''}" data-year="todos" onclick="filtrarPorAño(null)">Todos</span>`;

    yearsContainer.innerHTML = todos + Array.from(years)
        .sort((a, b) => b - a)
        .map(year => `<span class="year-badge${selectedYear === year ? ' active' : ''}" data-year="${year}" onclick="filtrarPorAño(${year})">${year}</span>`)
        .join('');
}

function agruparMomentosPorFecha() {
    const grupos = {};
    momentos.forEach(momento => {
        const fechaRecuerdo = momento.fecha_recuerdo || momento.fecha;
        const titulo = momento.titulo || 'Nuestro Momento';
        const tipo = momento.tipo === 'carta' ? 'carta' : 'foto';
        // El tipo entra en la clave: una carta nunca se agrupa con las fotos de ese día
        const key = `${tipo}-${fechaRecuerdo}-${titulo}`;

        if (!grupos[key]) {
            grupos[key] = {
                fecha: fechaRecuerdo,
                titulo: titulo,
                tipo: tipo,
                descripcion: momento.descripcion || (tipo === 'carta' ? '' : 'Un momento especial compartido'),
                fotos: []
            };
        }
        if (momento.foto_url) grupos[key].fotos.push(momento);
    });

    momentosAgrupados_full = Object.values(grupos);
    aplicarFiltro();
}

function aplicarFiltro() {
    momentosAgrupados = selectedYear === null
        ? momentosAgrupados_full
        : momentosAgrupados_full.filter(grupo => getYear(grupo.fecha) === selectedYear);

    miniCarrouselIndex = {};
    momentosAgrupados.forEach((_, i) => {
        miniCarrouselIndex[i] = 0;
    });
}

function filtrarPorAño(year) {
    // Volver a tocar el año activo lo deselecciona
    selectedYear = (year === null || selectedYear === year) ? null : year;

    aplicarFiltro();

    document.querySelectorAll('.year-badge').forEach(badge => {
        const badgeYear = badge.dataset.year === 'todos' ? null : parseInt(badge.dataset.year, 10);
        badge.classList.toggle('active', badgeYear === selectedYear);
    });

    renderCarousel();
    document.querySelector('.carousel-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCarousel() {
    momentosCarousel.innerHTML = '';

    if (momentosAgrupados.length === 0) {
        const mensaje = momentos.length === 0
            ? 'No hay momentos aún. ¡Agrega el primero! 💕'
            : `No hay momentos de ${selectedYear} 🌻`;
        momentosCarousel.innerHTML = `<div class="album-vacio"><p>${mensaje}</p></div>`;
        momentCounter.textContent = '0 / 0';
        return;
    }

    momentosAgrupados.forEach((grupo, index) => {
        const card = document.createElement('div');
        card.dataset.index = index;

        if (grupo.tipo === 'carta') {
            card.className = 'carta-card';
            card.innerHTML = plantillaCarta(grupo);
            card.addEventListener('click', () => abrirCarta(index));
        } else {
            card.className = 'momento-card';
            card.innerHTML = plantillaPolaroid(grupo, miniCarrouselIndex[index] || 0);
        }

        momentosCarousel.appendChild(card);
    });

    updateCarouselIndicator();
}

function plantillaPolaroid(grupo, fotoActual) {
    const titulo = escaparHtml(grupo.titulo);
    const total = grupo.fotos.length;

    const contador = total > 1
        ? `<div class="mini-carousel-controls"><span class="mini-carousel-counter">${fotoActual + 1}/${total}</span></div>`
        : '';

    return `
        <div class="momento-foto-container">
            <div class="mini-carousel">
                <div class="mini-carousel-track" style="transform: translate3d(-${fotoActual * 100}%, 0, 0)">
                    ${grupo.fotos.map(foto => `
                        <img src="${escaparHtml(foto.foto_url)}" alt="${titulo}" class="momento-foto" draggable="false">
                    `).join('')}
                </div>
            </div>
            ${contador}
        </div>
        <div class="momento-header">
            <div class="momento-titulo">${titulo}</div>
            <div class="momento-fecha">${formatearFecha(grupo.fecha)}</div>
        </div>
        <div class="momento-decoracion">🌻 ❤️ 🌻</div>
        <div class="momento-descripcion">"${escaparHtml(grupo.descripcion)}"</div>
    `;
}

function plantillaCarta(grupo) {
    const titulo = escaparHtml(grupo.titulo);
    const fecha = formatearFecha(grupo.fecha);
    const foto = grupo.fotos[0];

    return `
        <div class="sobre">
            <div class="sobre-cuerpo">
                <div class="sobre-membrete">
                    <div class="sobre-titulo">${titulo}</div>
                    <div class="sobre-fecha">${fecha}</div>
                </div>
            </div>
            <div class="sobre-solapa"></div>
            <div class="sobre-lacre">❤</div>
            <div class="sobre-pista">Toca el lacre</div>
        </div>
    `;
}

function abrirCarta(index) {
    const grupo = momentosAgrupados[index];
    const card = momentosCarousel.querySelector(`[data-index="${index}"]`);
    if (!grupo || !card || card.classList.contains('abierta')) return;

    card.classList.add('abierta');
    cartaAbierta = card;

    const foto = grupo.fotos[0];
    const titulo = escaparHtml(grupo.titulo);

    document.getElementById('carta-modal-hoja').innerHTML = `
        <div class="carta-hoja-interior">
            <div class="carta-encabezado">
                <div class="carta-titulo">${titulo}</div>
                <div class="carta-fecha">${formatearFecha(grupo.fecha)}</div>
            </div>
            ${foto ? `<img src="${escaparHtml(foto.foto_url)}" alt="${titulo}" class="carta-foto">` : ''}
            ${grupo.descripcion ? `<p class="carta-texto">${escaparHtml(grupo.descripcion)}</p>` : ''}
            <button class="btn-cerrar-sobre" onclick="cerrarCarta()">Cerrar el sobre</button>
        </div>
    `;

    document.body.style.overflow = 'hidden';

    // La carta asoma cuando la solapa ya se ha levantado
    setTimeout(() => {
        cartaModal.classList.remove('hidden');
        requestAnimationFrame(() => cartaModal.classList.add('visible'));
    }, 420);
}

function cerrarCarta() {
    cartaModal.classList.remove('visible');
    document.body.style.overflow = '';

    setTimeout(() => {
        cartaModal.classList.add('hidden');

        // Y ya sin la carta encima, el sobre se vuelve a cerrar a la vista
        if (cartaAbierta) {
            cartaAbierta.classList.remove('abierta');
            cartaAbierta = null;
        }
    }, 400);
}

function escaparHtml(texto) {
    const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(texto ?? '').replace(/[&<>"']/g, caracter => escapes[caracter]);
}

function nextMiniCarrusel(index) {
    const grupo = momentosAgrupados[index];
    if (!grupo) return;

    const currentIndex = miniCarrouselIndex[index] || 0;
    if (currentIndex < grupo.fotos.length - 1) {
        miniCarrouselIndex[index] = currentIndex + 1;
        updateMiniCarrusel(index);
    }
}

function prevMiniCarrusel(index) {
    const currentIndex = miniCarrouselIndex[index] || 0;
    if (currentIndex > 0) {
        miniCarrouselIndex[index] = currentIndex - 1;
        updateMiniCarrusel(index);
    }
}

function updateMiniCarrusel(index) {
    const grupo = momentosAgrupados[index];
    if (!grupo) return;

    const fotoActual = miniCarrouselIndex[index] || 0;
    const card = momentosCarousel.querySelector(`[data-index="${index}"]`);
    if (!card) return;

    const track = card.querySelector('.mini-carousel-track');
    if (track) {
        track.classList.remove('dragging');
        track.style.transform = `translate3d(-${fotoActual * 100}%, 0, 0)`;
    }

    const counter = card.querySelector('.mini-carousel-counter');
    if (counter) counter.textContent = `${fotoActual + 1}/${grupo.fotos.length}`;
}

function updateCarouselIndicator() {
    const total = momentosAgrupados.length;
    momentCounter.textContent = total === 1 ? '1 recuerdo' : `${total} recuerdos`;
}

// ==================== UPLOAD ====================
function toggleUploadForm() {
    uploadFormContainer.classList.toggle('hidden');
    if (!uploadFormContainer.classList.contains('hidden')) {
        document.getElementById('foto').value = '';
        document.getElementById('titulo').value = '';
        document.getElementById('fecha-recuerdo').value = '';
        document.getElementById('descripcion').value = '';
        cambiarTipo('foto');
    }
}

function cambiarTipo(tipo) {
    tipoActual = tipo === 'carta' ? 'carta' : 'foto';
    const esCarta = tipoActual === 'carta';

    document.querySelectorAll('.tipo-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tipo === tipoActual);
    });

    const inputFoto = document.getElementById('foto');
    inputFoto.required = !esCarta;
    inputFoto.multiple = !esCarta;

    document.getElementById('upload-title').textContent = esCarta ? 'Escribir una Carta' : 'Agregar un Nuevo Momento';
    document.getElementById('foto-label').textContent = esCarta ? 'Foto de la carta (opcional)' : 'Fotos';
    document.getElementById('fecha-label').textContent = esCarta ? 'Fecha de la carta' : 'Fecha del Recuerdo';
    document.getElementById('descripcion-label').textContent = esCarta ? 'La carta' : 'Recuerdo o Frase';

    const texto = document.getElementById('descripcion');
    texto.rows = esCarta ? 9 : 4;
    texto.placeholder = esCarta
        ? 'Querida...'
        : 'Cuéntale a nuestro futuro yo qué sentiste en este momento...';

    uploadForm.querySelector('button[type="submit"]').textContent = esCarta ? 'Guardar Carta' : 'Guardar Momento';
    clearMessages();
}

function subirFoto(event) {
    event.preventDefault();
    clearMessages();

    const fotos = Array.from(document.getElementById('foto').files);
    const titulo = document.getElementById('titulo').value;
    const fechaRecuerdo = document.getElementById('fecha-recuerdo').value;
    const descripcion = document.getElementById('descripcion').value;
    const submitBtn = uploadForm.querySelector('button[type="submit"]');

    const esCarta = tipoActual === 'carta';

    if (!titulo) {
        showError(uploadError, 'Ingresa un título');
        return;
    }

    if (!fechaRecuerdo) {
        showError(uploadError, esCarta ? 'Selecciona la fecha de la carta' : 'Selecciona la fecha del recuerdo');
        return;
    }

    if (!esCarta && fotos.length === 0) {
        showError(uploadError, 'Selecciona al menos una foto');
        return;
    }

    if (esCarta && fotos.length === 0 && !descripcion.trim()) {
        showError(uploadError, 'Escribe la carta o adjunta una foto de ella');
        return;
    }

    // La carta es un único envío aunque no lleve foto; las fotos van de una en una
    const envios = esCarta ? [fotos[0] || null] : fotos;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Preparando...';

    // De una en una: subir varias a la vez satura la subida del móvil y la
    // memoria del servidor, y deja el botón sin poder decir por dónde va
    enviarEnFila(envios, { esCarta, titulo, fechaRecuerdo, descripcion, submitBtn })
        .then(results => {
            showSuccess(uploadSuccess, esCarta ? 'Carta guardada 💌' : `${results.length} foto(s) guardada(s) con éxito`);
            uploadForm.reset();
            setTimeout(() => {
                toggleUploadForm();
                cargarMomentos();
                submitBtn.disabled = false;
                submitBtn.textContent = esCarta ? 'Guardar Carta' : 'Guardar Momento';
            }, 1000);
        })
        .catch(err => {
            console.error('Upload error:', err);
            showError(uploadError, err.message || 'Error al guardar');
            submitBtn.disabled = false;
            submitBtn.textContent = esCarta ? 'Guardar Carta' : 'Guardar Momento';
        });
}

async function enviarEnFila(envios, { esCarta, titulo, fechaRecuerdo, descripcion, submitBtn }) {
    const guardados = [];

    for (let i = 0; i < envios.length; i++) {
        const etiqueta = esCarta ? 'Guardando carta' : `Guardando ${i + 1}/${envios.length}`;

        submitBtn.textContent = etiqueta + ' · preparando...';
        const foto = envios[i] ? await reducirImagen(envios[i]) : null;

        let rutaFoto = '';
        if (foto) {
            submitBtn.textContent = etiqueta + ' · subiendo...';
            rutaFoto = await subirFotoAlAlmacen(foto);
        }

        submitBtn.textContent = etiqueta + '...';
        const { data, error } = await db.from(SUPABASE_CONFIG.tabla).insert({
            titulo,
            descripcion,
            fecha_recuerdo: fechaRecuerdo,
            tipo: esCarta ? 'carta' : 'foto',
            foto_url: rutaFoto
        }).select().single();

        if (error) throw new Error(`No se pudo guardar el recuerdo: ${error.message}`);
        guardados.push(data);
    }

    return guardados;
}


// Una foto de móvil pesa 10 MB; enviarla entera por datos es lo que dejaba
// el botón colgado en "Guardando". Se reduce aquí antes de salir.
async function reducirImagen(file) {
    const esImagen = /^image\//i.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!esImagen || (file.size < 600 * 1024 && !esHeic(file))) return file;

    try {
        const fuente = await abrirImagen(file);
        const escala = Math.min(1, 1800 / Math.max(fuente.width, fuente.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(fuente.width * escala);
        lienzo.height = Math.round(fuente.height * escala);
        lienzo.getContext('2d').drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
        if (fuente.close) fuente.close();

        const blob = await new Promise(listo => lienzo.toBlob(listo, 'image/jpeg', 0.85));
        if (!blob) return file;

        // Un HEIC se convierte aunque no adelgace: al servidor pequeño le cuesta
        // demasiado decodificar 12 MP y ahí es donde se atascaban las subidas
        if (blob.size >= file.size && !esHeic(file)) return file;

        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (err) {
        console.warn('No se pudo convertir la imagen, se sube el original:', err);
        return file;
    }
}

function esHeic(file) {
    return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

async function abrirImagen(file) {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (err) {
        // Chrome en Android no pinta HEIC, así que se tira de libheif
        if (!esHeic(file)) throw err;
        return decodificarHeicAqui(file);
    }
}

// El decodificador pesa 1,9 MB, así que solo se carga si aparece un HEIC
let libheifCargando = null;

function cargarLibheif() {
    if (!libheifCargando) {
        libheifCargando = new Promise((listo, fallar) => {
            const etiqueta = document.createElement('script');
            etiqueta.src = 'vendor/libheif.js';
            etiqueta.onload = listo;
            etiqueta.onerror = () => fallar(new Error('No se pudo cargar el decodificador HEIC'));
            document.head.appendChild(etiqueta);
        // window.libheif es una fábrica: hay que invocarla para tener el módulo
        }).then(() => window.libheif());
    }

    return libheifCargando;
}

async function decodificarHeicAqui(file) {
    const libheif = await cargarLibheif();
    const imagenes = new libheif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
    if (!imagenes || !imagenes.length) throw new Error('El HEIC no contiene ninguna imagen');

    const imagen = imagenes[0];
    const ancho = imagen.get_width();
    const alto = imagen.get_height();

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;

    const contexto = lienzo.getContext('2d');
    const pixeles = contexto.createImageData(ancho, alto);

    await new Promise((listo, fallar) => {
        imagen.display(pixeles, resultado => resultado ? listo() : fallar(new Error('libheif no pudo pintar el HEIC')));
    });

    contexto.putImageData(pixeles, 0, 0);
    return lienzo;
}

// ==================== TOUCH/SWIPE ====================
function handleMiniCarrouselTouchStart(event) {
    arrastre = null;

    const contenedor = event.target.closest('.momento-foto-container');
    if (!contenedor) return;

    const track = contenedor.querySelector('.mini-carousel-track');
    const card = contenedor.closest('.momento-card');
    if (!track || !card) return;

    const cardIndex = Number(card.dataset.index);
    const grupo = momentosAgrupados[cardIndex];
    if (!grupo || grupo.fotos.length < 2) return;

    const touch = event.changedTouches[0];
    arrastre = {
        track,
        cardIndex,
        total: grupo.fotos.length,
        indice: miniCarrouselIndex[cardIndex] || 0,
        startX: touch.screenX,
        startY: touch.screenY,
        ancho: track.offsetWidth || 1,
        horizontal: false,
        delta: 0
    };
}

function handleMiniCarrouselTouchMove(event) {
    if (!arrastre) return;

    const touch = event.changedTouches[0];
    const dx = touch.screenX - arrastre.startX;
    const dy = touch.screenY - arrastre.startY;

    // Hasta que el gesto se declare horizontal no le quitamos el scroll a la página
    if (!arrastre.horizontal) {
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
        arrastre.horizontal = true;
        arrastre.track.classList.add('dragging');
    }

    event.preventDefault();

    // En el primer y último fotograma la foto cede menos, así se siente el tope
    const enElTope = (arrastre.indice === 0 && dx > 0) ||
                     (arrastre.indice === arrastre.total - 1 && dx < 0);
    arrastre.delta = enElTope ? dx * 0.32 : dx;

    const base = -arrastre.indice * arrastre.ancho;
    arrastre.track.style.transform = `translate3d(${base + arrastre.delta}px, 0, 0)`;
}

function handleMiniCarrouselTouchEnd() {
    if (!arrastre) return;

    const gesto = arrastre;
    arrastre = null;
    gesto.track.classList.remove('dragging');

    if (!gesto.horizontal) return;

    const umbral = gesto.ancho * 0.18;
    const avanza = gesto.delta < -umbral;
    const retrocede = gesto.delta > umbral;

    if (avanza && gesto.indice < gesto.total - 1) {
        nextMiniCarrusel(gesto.cardIndex);
    } else if (retrocede && gesto.indice > 0) {
        prevMiniCarrusel(gesto.cardIndex);
    } else {
        updateMiniCarrusel(gesto.cardIndex);
    }
}

// ==================== LLUVIA DE CORAZONES ====================
function createHeartRain() {
    const hearts = ['❤️', '💕', '💗', '💖'];

    setInterval(() => {
        const heart = document.createElement('div');
        heart.className = 'heart-rain';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.animationDuration = (3 + Math.random() * 3) + 's';
        heart.style.animationDelay = Math.random() * 2 + 's';

        document.body.appendChild(heart);

        setTimeout(() => heart.remove(), 7000);
    }, 400);
}

// ==================== UTILIDADES ====================
function showScreen(screenName) {
    splashScreen.classList.remove('active');
    mainScreen.classList.remove('active');

    if (screenName === 'splash') splashScreen.classList.add('active');
    if (screenName === 'main') mainScreen.classList.add('active');
}

function formatearFecha(fecha) {
    const date = new Date(fecha);
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', opciones);
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function showSuccess(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function clearMessages() {
    uploadError.classList.remove('show');
    uploadSuccess.classList.remove('show');
}

// ==================== INIT ====================
window.addEventListener('load', () => {
    // Iniciar directo con splash screen
    showScreen('splash');
    resetHeart();

    // Iniciar lluvia de corazones
    createHeartRain();
});
