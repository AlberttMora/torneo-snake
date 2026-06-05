const canvas = document.getElementById('canvas-juego');
const ctx = canvas ? canvas.getContext('2d') : null; 

const TAMANO_BLOQUE = 20;
let TOTAL_BLOQUES = 20; 

if (canvas) {
    TOTAL_BLOQUES = canvas.width / TAMANO_BLOQUE;
}

let culebrita = [];
let direccion = { x: 1, y: 0 }; 

// [AM] FIX CRÍTICO: ultimaDireccion guarda la dirección que se usó en el ÚLTIMO tick real.
// Los guards del teclado/touch deben comparar contra ésta, NO contra "direccion".
// Sin esto, dos cambios de dirección rápidos en el mismo tick pasan ambos guards
// y causan que la culebrita se doble sobre sí misma → colisión falsa en segmento[2].
let ultimaDireccion = { x: 1, y: 0 };

let manzana = { x: 0, y: 0 };
let puntos = 0;
let juegoIntervalo = null;
let juegoCorriendo = false;

// Variables globales para guardar dónde inicia y termina el dedo en el cel
let toqueIniciX = 0;
let toqueIniciY = 0;

window.iniciarJuegoCulebrita = function() {
    if (!canvas) return;

    puntos = 0;
    culebrita = [{ x: 10, y: 10 }];
    direccion = { x: 1, y: 0 }; // Arranca hacia la derecha
    ultimaDireccion = { x: 1, y: 0 }; // [AM] FIX: resetear junto con direccion
    juegoCorriendo = true;

    generarManzana();
    configurarControlesTeclado();
    configurarControlesTactiles(); // 🔥 Activamos el lector del celular

    // [AM] FIX: Limpiamos el intervalo anterior y lo nulleamos antes de crear uno nuevo
    // Esto evita que queden dos buclePrincipal corriendo al mismo tiempo entre rondas
    if (juegoIntervalo) {
        clearInterval(juegoIntervalo);
        juegoIntervalo = null;
    }
    juegoIntervalo = setInterval(buclePrincipal, 120);
    
    dibujarTodo();
};

function buclePrincipal() {
    // [AM] FIX: Guard de seguridad — si el juego ya terminó, no ejecutar nada.
    // Protege contra intervalos zombie que puedan quedar de rondas anteriores.
    if (!juegoCorriendo) return;

    moverCulebrita();

    // verificarComida va ANTES de verificarColisiones para que
    // el pop ocurra primero y verificarColisiones vea la culebrita en su
    // estado real, sin el segmento extra de la cola vieja
    verificarComida();

    if (verificarColisiones()) {
        terminarJuego();
        return;
    }

    dibujarTodo();
}

function moverCulebrita() {
    // [AM] FIX CRÍTICO: Guardamos la dirección ANTES de mover.
    // ultimaDireccion representa el movimiento real que acaba de ocurrir,
    // y es lo que usan los guards de teclado/touch para evitar reversa instantánea.
    ultimaDireccion = { x: direccion.x, y: direccion.y };

    const cabeza = { x: culebrita[0].x + direccion.x, y: culebrita[0].y + direccion.y };
    culebrita.unshift(cabeza);
    // El pop lo maneja verificarComida
}

function verificarComida() {
    const cabeza = culebrita[0];
    if (cabeza && cabeza.x === manzana.x && cabeza.y === manzana.y) {
        puntos += 10;
        if (typeof window.notificarManzanaComida === 'function') {
            window.notificarManzanaComida(puntos);
        }
        generarManzana();
        // No hacemos pop → culebrita crece
    } else {
        culebrita.pop(); // Movimiento normal → elimina la cola
    }
}

function verificarColisiones() {
    const cabeza = culebrita[0];
    if (!cabeza) return true;

    if (cabeza.x < 0 || cabeza.x >= TOTAL_BLOQUES || cabeza.y < 0 || cabeza.y >= TOTAL_BLOQUES) {
        console.log(`MUERTE MURO: cabeza=(${cabeza.x},${cabeza.y}) TOTAL_BLOQUES=${TOTAL_BLOQUES}`);
        return true;
    }

    for (let i = 1; i < culebrita.length; i++) {
        if (cabeza.x === culebrita[i].x && cabeza.y === culebrita[i].y) {
            console.log(`MUERTE CUERPO: cabeza=(${cabeza.x},${cabeza.y}) chocó segmento[${i}]=(${culebrita[i].x},${culebrita[i].y}) longitud=${culebrita.length}`);
            return true;
        }
    }

    return false;
}

function generarManzana() {
    manzana = {
        x: Math.floor(Math.random() * TOTAL_BLOQUES),
        y: Math.floor(Math.random() * TOTAL_BLOQUES)
    };
}

function configurarControlesTeclado() {
    document.removeEventListener('keydown', manejarTeclado);
    document.addEventListener('keydown', manejarTeclado);
}

function manejarTeclado(evento) {
    // [AM] FIX CRÍTICO: Comparamos contra ultimaDireccion (el movimiento real del
    // último tick), NO contra direccion (que ya pudo haber cambiado este tick).
    // Esto evita que dos teclas rápidas en el mismo tick anulen el guard anti-reversa.
    switch(evento.key) {
        case 'ArrowUp':
            if (ultimaDireccion.y !== 1) direccion = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (ultimaDireccion.y !== -1) direccion = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (ultimaDireccion.x !== 1) direccion = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (ultimaDireccion.x !== -1) direccion = { x: 1, y: 0 };
            break;
    }
}

// [AM] FIX: Handlers nombrados para poder hacer removeEventListener correctamente
// antes eran funciones anónimas dentro de configurarControlesTactiles(), lo que
// acumulaba un listener nuevo por cada ronda iniciada y causaba game overs fantasma
function manejarTouchStart(e) {
    toqueIniciX = e.touches[0].clientX;
    toqueIniciY = e.touches[0].clientY;
}

function manejarTouchEnd(e) {
    if (!toqueIniciX || !toqueIniciY) return;

    const toqueFinX = e.changedTouches[0].clientX;
    const toqueFinY = e.changedTouches[0].clientY;

    // Calculamos la distancia del desplazamiento matemático (Vectores Δx y Δy)
    const difX = toqueFinX - toqueIniciX;
    const difY = toqueFinY - toqueIniciY;

    // Definimos un mínimo de píxeles para que no gire por error (sensibilidad)
    const umbralSensibilidad = 30; 

    if (Math.abs(difX) > Math.abs(difY)) {
        // El movimiento fue mayormente HORIZONTAL (Izquierda o Derecha)
        if (Math.abs(difX) > umbralSensibilidad) {
            // [AM] FIX CRÍTICO: Usamos ultimaDireccion para el guard, igual que teclado
            if (difX > 0 && ultimaDireccion.x !== -1) {
                direccion = { x: 1, y: 0 }; // Deslizó a la derecha
            } else if (difX < 0 && ultimaDireccion.x !== 1) {
                direccion = { x: -1, y: 0 }; // Deslizó a la izquierda
            }
        }
    } else {
        // El movimiento fue mayormente VERTICAL (Arriba o Abajo)
        if (Math.abs(difY) > umbralSensibilidad) {
            // [AM] FIX CRÍTICO: Usamos ultimaDireccion para el guard, igual que teclado
            if (difY > 0 && ultimaDireccion.y !== -1) {
                direccion = { x: 0, y: 1 }; // Deslizó hacia abajo
            } else if (difY < 0 && ultimaDireccion.y !== 1) {
                direccion = { x: 0, y: -1 }; // Deslizó hacia arriba
            }
        }
    }

    // Reiniciamos variables para el próximo deslizamiento
    toqueIniciX = 0;
    toqueIniciY = 0;
}

function configurarControlesTactiles() {
    if (!canvas) return;

    // [AM] FIX: Removemos antes de agregar, igual que configurarControlesTeclado()
    // Esto evita que se apilen múltiples listeners al reiniciar el juego entre rondas
    canvas.removeEventListener('touchstart', manejarTouchStart);
    canvas.removeEventListener('touchend', manejarTouchEnd);

    canvas.addEventListener('touchstart', manejarTouchStart, { passive: true });
    canvas.addEventListener('touchend', manejarTouchEnd, { passive: true });
}

function dibujarTodo() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo Negro
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Manzana Roja
    ctx.fillStyle = '#ff3838';
    ctx.fillRect(manzana.x * TAMANO_BLOQUE, manzana.y * TAMANO_BLOQUE, TAMANO_BLOQUE - 2, TAMANO_BLOQUE - 2);

    // Culebrita Verde
    culebrita.forEach((bloque, indice) => {
        ctx.fillStyle = (indice === 0) ? '#58ff6d' : '#2ea44f';
        ctx.fillRect(bloque.x * TAMANO_BLOQUE, bloque.y * TAMANO_BLOQUE, TAMANO_BLOQUE - 2, TAMANO_BLOQUE - 2);
    });
}

function terminarJuego() {
    clearInterval(juegoIntervalo);
    juegoIntervalo = null; // [AM] FIX: nulleamos para que iniciarJuegoCulebrita
                           // sepa que no hay intervalo activo en la próxima ronda
    juegoCorriendo = false;
    
    if (ctx && canvas) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff3838';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('¡GAME OVER!', canvas.width / 2, canvas.height / 2 - 10);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(`Puntaje final: ${puntos} pts`, canvas.width / 2, canvas.height / 2 + 30);
    }

    if (typeof window.notificarMuerteJugador === 'function') {
        window.notificarMuerteJugador();
    }

    const btnVolver = document.getElementById('btn-volver-lobby');
    if (btnVolver) {
        btnVolver.style.display = 'inline-block';
    }
}