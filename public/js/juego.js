const canvas = document.getElementById('canvas-juego');
const ctx = canvas ? canvas.getContext('2d') : null; 

const TAMANO_BLOQUE = 20;
let TOTAL_BLOQUES = 20; 

if (canvas) {
    TOTAL_BLOQUES = canvas.width / TAMANO_BLOQUE;
}

let culebrita = [];
let direccion = { x: 1, y: 0 }; 
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
    juegoCorriendo = true;

    generarManzana();
    configurarControlesTeclado();
    configurarControlesTactiles(); // 🔥 Activamos el lector del celular

    if (juegoIntervalo) clearInterval(juegoIntervalo);
    juegoIntervalo = setInterval(buclePrincipal, 120);
    
    dibujarTodo();
};

function buclePrincipal() {
    moverCulebrita();
    
    if (verificarColisiones()) {
        terminarJuego();
        return;
    }

    verificarComida();
    dibujarTodo();
}

function moverCulebrita() {
    const cabeza = {
        x: culebrita[0].x + direccion.x,
        y: culebrita[0].y + direccion.y
    };
    culebrita.unshift(cabeza);
}

function verificarComida() {
    const cabeza = culebrita[0];
    if (cabeza && cabeza.x === manzana.x && cabeza.y === manzana.y) {
        puntos += 10;
        if (typeof window.notificarManzanaComida === 'function') {
            window.notificarManzanaComida(puntos);
        }
        generarManzana();
        // No hacemos pop → crece
    } else {
        culebrita.pop(); // ← el pop va aquí
    }
}

function verificarColisiones() {
    const cabeza = culebrita[0];
    if (!cabeza) return true;

    if (cabeza.x < 0 || cabeza.x >= TOTAL_BLOQUES || cabeza.y < 0 || cabeza.y >= TOTAL_BLOQUES) {
        return true;
    }

    for (let i = 1; i < culebrita.length; i++) {
        if (cabeza.x === culebrita[i].x && cabeza.y === culebrita[i].y) {
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
    switch(evento.key) {
        case 'ArrowUp':
            if (direccion.y !== 1) direccion = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (direccion.y !== -1) direccion = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (direccion.x !== 1) direccion = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (direccion.x !== -1) direccion = { x: 1, y: 0 };
            break;
    }
}

function configurarControlesTactiles() {
    if (!canvas) return;

    // Cuando el alumno apoya el dedo en la pantalla
    canvas.addEventListener('touchstart', (e) => {
        toqueIniciX = e.touches[0].clientX;
        toqueIniciY = e.touches[0].clientY;
    }, { passive: true });

    // Cuando el alumno mueve y despega el dedo de la pantalla
    canvas.addEventListener('touchend', (e) => {
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
                if (difX > 0 && direccion.x !== -1) {
                    direccion = { x: 1, y: 0 }; // Deslizó a la derecha
                } else if (difX < 0 && direccion.x !== 1) {
                    direccion = { x: -1, y: 0 }; // Deslizó a la izquierda
                }
            }
        } else {
            // El movimiento fue mayormente VERTICAL (Arriba o Abajo)
            if (Math.abs(difY) > umbralSensibilidad) {
                if (difY > 0 && direccion.y !== -1) {
                    direccion = { x: 0, y: 1 }; // Deslizó hacia abajo
                } else if (difY < 0 && direccion.y !== 1) {
                    direccion = { x: 0, y: -1 }; // Deslizó hacia arriba
                }
            }
        }

        // Reiniciamos variables para el próximo deslizamiento
        toqueIniciX = 0;
        toqueIniciY = 0;
    }, { passive: true });
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
