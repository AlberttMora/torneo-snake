const canvas = document.getElementById('canvas-juego');
const ctx = canvas ? canvas.getContext('2d') : null;

const TAMANO_BLOQUE = 20;
let TOTAL_BLOQUES = 20;

let tiempoLimiteJuegoSegundos = 300;
let tiempoJuegoRestante = 300;
let timerJuego = null;

function iniciarTimerJuego() {

    clearInterval(timerJuego);

    tiempoJuegoRestante = tiempoLimiteJuegoSegundos;

    timerJuego = setInterval(() => {

        if (!juegoCorriendo) {
            clearInterval(timerJuego);
            timerJuego = null;
            return;
        }

        tiempoJuegoRestante--;

        console.log(`⏱️ Tiempo restante: ${tiempoJuegoRestante}s`);

        if (tiempoJuegoRestante <= 0) {

            clearInterval(timerJuego);
            timerJuego = null;

            terminarJuego();
        }

    }, 1000);
}

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

// [AM] Bandera para saber si el juego está congelado esperando que respondan la pregunta.
// Mientras esté en true, buclePrincipal no debe correr (por eso no reiniciamos el intervalo).
let esperandoRespuesta = false;

// [AM] IDs de temporizadores del modal de pregunta, para poder limpiarlos sin dejar basura.
let respuestaTimeoutId = null;
let respuestaIntervaloId = null;

// Variables globales para guardar dónde inicia y termina el dedo en el cel
let toqueIniciX = 0;
let toqueIniciY = 0;

window.iniciarJuegoCulebrita = function () {

    mostrarAvisoInicio();

    if (!canvas) return;

    // Tomar el tiempo enviado por el Admin
    tiempoLimiteJuegoSegundos =
        window.tiempoLimiteJuego || 300;

    tiempoJuegoRestante = tiempoLimiteJuegoSegundos;

    puntos = 0;

    culebrita = [{ x: 10, y: 10 }];

    direccion = { x: 1, y: 0 };
    ultimaDireccion = { x: 1, y: 0 };

    juegoCorriendo = true;
    esperandoRespuesta = false;

    const modalPregunta =
        document.getElementById('modal-pregunta');

    if (modalPregunta) {
        modalPregunta.style.display = 'none';
    }

    generarManzana();

    configurarControlesTeclado();
    configurarControlesTactiles();

    if (juegoIntervalo) {
        clearInterval(juegoIntervalo);
        juegoIntervalo = null;
    }

    juegoIntervalo = setInterval(
        buclePrincipal,
        120
    );

    // Iniciar contador del torneo
    iniciarTimerJuego();

    dibujarTodo();
};

function buclePrincipal() {
    // [AM] FIX: Guard de seguridad — si el juego ya terminó, no ejecutar nada.
    // Protege contra intervalos zombie que puedan quedar de rondas anteriores.
    if (!juegoCorriendo) return;

    // [AM] Si estamos esperando que respondan la pregunta, el juego está congelado.
    if (esperandoRespuesta) return;

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
    ultimaDireccion = { x: direccion.x, y: direccion.y };
    const cabeza = { x: culebrita[0].x + direccion.x, y: culebrita[0].y + direccion.y };

    // Log para ver a dónde intenta ir la culebrita
    console.log(`DEBUG: Moviendo a (${cabeza.x}, ${cabeza.y}) con dir (${direccion.x}, ${direccion.y})`);

    culebrita.unshift(cabeza);
}

function verificarComida() {
    const cabeza = culebrita[0];
    if (cabeza && cabeza.x === manzana.x && cabeza.y === manzana.y) {
        // [AM] Ya no sumamos puntos ni regeneramos la manzana de una vez:
        // primero hay que responder correctamente la pregunta.
        pausarParaPregunta();
    } else {
        culebrita.pop(); // Movimiento normal → elimina la cola
    }
}

function verificarColisiones() {
    const cabeza = culebrita[0];
    if (!cabeza) return true;

    // Verificar muros
    if (cabeza.x < 0 || cabeza.x >= TOTAL_BLOQUES || cabeza.y < 0 || cabeza.y >= TOTAL_BLOQUES) {
        console.log(`💀 MUERTE POR MURO en (${cabeza.x}, ${cabeza.y})`);
        return true;
    }

    // Verificar cuerpo con detalle
    for (let i = 1; i < culebrita.length; i++) {
        if (cabeza.x === culebrita[i].x && cabeza.y === culebrita[i].y) {
            console.log(`💀 MUERTE POR CUERPO detectada:`);
            console.log(`   -> Cabeza en: (${cabeza.x}, ${cabeza.y})`);
            console.log(`   -> Chocó con segmento [${i}] en: (${culebrita[i].x}, ${culebrita[i].y})`);
            console.log(`   -> Longitud total de culebra: ${culebrita.length}`);
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

// [AM] Congela el juego y muestra el modal de pregunta al comer la manzana.
function pausarParaPregunta() {
    if (juegoIntervalo) {
        clearInterval(juegoIntervalo);
        juegoIntervalo = null;
    }
    esperandoRespuesta = true;
    dibujarTodo(); // Deja la pantalla congelada con la culebrita sobre la manzana
    mostrarModalPregunta();
}

// [AM] Muestra el modal, arranca la cuenta regresiva y espera la respuesta del jugador.
// [AM] Guarda el índice de la última pregunta usada, para no repetirla seguido si hay más de una.
let ultimaPreguntaIndice = -1;

// [AM] Elige una pregunta al azar de window.LISTA_PREGUNTAS, evitando repetir la anterior.
function elegirPreguntaAleatoria() {
    const lista = window.LISTA_PREGUNTAS || [];

    if (lista.length === 0) {
        // [AM] Modo compatibilidad: si el admin no ha cargado preguntas, usamos una por defecto
        // para que el juego no se rompa (siempre pide lo mismo hasta que carguen preguntas reales).
        return { texto: "El admin aún no ha cargado preguntas. ¿Cuánto es 2 + 2?", respuesta: "4", tiempoLimite: 5 };
    }

    if (lista.length === 1) {
        ultimaPreguntaIndice = 0;
        return lista[0];
    }

    let indice;
    do {
        indice = Math.floor(Math.random() * lista.length);
    } while (indice === ultimaPreguntaIndice);

    ultimaPreguntaIndice = indice;
    return lista[indice];
}

// [AM] Muestra el modal, arranca la cuenta regresiva y espera la respuesta del jugador.
// [AM] Muestra el modal, arranca la cuenta regresiva y espera la respuesta del jugador.
// Soporta dos modos: opción múltiple (botones A/B/C/D) o respuesta libre (input de texto).
function mostrarModalPregunta() {
    const modal = document.getElementById('modal-pregunta');
    const txtPregunta = document.getElementById('txt-pregunta-modal');
    const inputRespuesta = document.getElementById('input-respuesta');
    const contenedorOpciones = document.getElementById('opciones-pregunta');
    const lblTimer = document.getElementById('timer-pregunta');
    const lblFeedback = document.getElementById('feedback-pregunta');
    const btnResponder = document.getElementById('btn-responder');

    // [AM] Modo compatibilidad: si el HTML no tiene el modal, no bloqueamos el juego.
    if (!modal || !txtPregunta || !lblTimer) {
        resolverPregunta(true);
        return;
    }

    const pregunta = elegirPreguntaAleatoria();
    const esOpcionMultiple = Array.isArray(pregunta.opciones) && pregunta.opciones.length > 0;
    const tiempoLimiteSeg = Number(pregunta.tiempoLimite) > 0 ? Number(pregunta.tiempoLimite) : (esOpcionMultiple ? 8 : 5);
    const tiempoLimiteMs = tiempoLimiteSeg * 1000;
    let tiempoRestante = tiempoLimiteSeg;

    txtPregunta.textContent = pregunta.texto;
    if (lblFeedback) lblFeedback.textContent = '';
    lblTimer.textContent = `⏱️ ${tiempoRestante}s`;
    modal.style.display = 'flex';

    const tiempoInicio = Date.now();

    respuestaIntervaloId = setInterval(() => {
        tiempoRestante -= 1;
        lblTimer.textContent = `⏱️ ${Math.max(tiempoRestante, 0)}s`;
    }, 1000);

    let yaRespondio = false;

    // [AM] Punto único de salida: sea por click en una opción, por Enter, o por timeout.
    function finalizar(acerto) {
        if (yaRespondio) return;
        yaRespondio = true;
        clearInterval(respuestaIntervaloId);
        clearTimeout(respuestaTimeoutId);
        modal.style.display = 'none';
        resolverPregunta(acerto);
    }

    if (esOpcionMultiple) {
        // [AM] Modo opción múltiple: mostramos botones A/B/C/D y ocultamos el input libre.
        if (inputRespuesta) inputRespuesta.style.display = 'none';
        if (btnResponder) btnResponder.style.display = 'none';

        if (contenedorOpciones) {
            contenedorOpciones.style.display = 'flex';
            contenedorOpciones.innerHTML = '';

            pregunta.opciones.forEach((opcion) => {
                const btnOpcion = document.createElement('button');
                btnOpcion.className = 'opcion-btn';
                btnOpcion.textContent = `${opcion.letra}) ${opcion.texto}`;
                btnOpcion.addEventListener('click', () => {
                    const tiempoUsado = Date.now() - tiempoInicio;
                    const acerto = opcion.letra.toUpperCase() === (pregunta.respuesta || '').trim().toUpperCase()
                        && tiempoUsado <= tiempoLimiteMs;
                    finalizar(acerto);
                });
                contenedorOpciones.appendChild(btnOpcion);
            });
        }
    } else {
        // [AM] Modo respuesta libre (compatibilidad con preguntas de texto, sin opciones)
        if (contenedorOpciones) {
            contenedorOpciones.style.display = 'none';
            contenedorOpciones.innerHTML = '';
        }
        if (inputRespuesta) {
            inputRespuesta.style.display = 'block';
            inputRespuesta.value = '';
            inputRespuesta.focus();
        }
        if (btnResponder) btnResponder.style.display = 'inline-block';

        function manejarEnvio() {
            const tiempoUsado = Date.now() - tiempoInicio;
            const respuestaUsuario = inputRespuesta.value.trim().toLowerCase();
            const respuestaCorrecta = (pregunta.respuesta || '').trim().toLowerCase();
            const acerto = respuestaUsuario !== '' && respuestaUsuario === respuestaCorrecta && tiempoUsado <= tiempoLimiteMs;
            btnResponder.removeEventListener('click', manejarEnvio);
            inputRespuesta.removeEventListener('keydown', manejarEnter);
            finalizar(acerto);
        }

        function manejarEnter(evento) {
            if (evento.key === 'Enter') manejarEnvio();
        }

        btnResponder.addEventListener('click', manejarEnvio);
        inputRespuesta.addEventListener('keydown', manejarEnter);
    }

    // [AM] Si se acaba el tiempo mínimo sin responder, cuenta como fallo automático.
    respuestaTimeoutId = setTimeout(() => {
        finalizar(false);
    }, tiempoLimiteMs);
}

// [AM] Aplica el resultado de la pregunta: punto y sigue normal, o castigo de 3s sin punto.
function resolverPregunta(acerto) {
    esperandoRespuesta = false;

    if (acerto) {
        puntos += 10;
        if (typeof window.notificarManzanaComida === 'function') {
            window.notificarManzanaComida(puntos);
        }
        generarManzana();
        reanudarJuego();
    } else {
        // [AM] Castigo: no gana el punto y la culebrita NO crece
        // (se comporta como un movimiento normal, se le quita la cola extra).
        culebrita.pop();
        generarManzana();
        mostrarCastigo();
    }
}

// [AM] Pantalla roja de penalización durante 3 segundos, luego reanuda el juego.
function mostrarCastigo() {
    let segundos = 3;

    function actualizarTexto() {
        if (ctx && canvas) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.35)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';

            ctx.fillText(
                '❌ Respuesta incorrecta',
                canvas.width / 2,
                canvas.height / 2 - 10
            );

            ctx.fillText(
                `Penalización: ${segundos}s`,
                canvas.width / 2,
                canvas.height / 2 + 20
            );
        }

        if (segundos > 1) {
            segundos--;

            setTimeout(actualizarTexto, 1000);
        } else {
            setTimeout(() => {
                reanudarJuego();
            }, 1000);
        }
    }

    actualizarTexto();
}

// [AM] Reanuda el bucle del juego si sigue vivo y no hay otro intervalo corriendo.
function reanudarJuego() {
    if (!juegoCorriendo) return; // El jugador pudo haber muerto mientras respondía/pagaba castigo
    if (juegoIntervalo) return; // Ya está corriendo, evita duplicar el intervalo
    juegoIntervalo = setInterval(buclePrincipal, 120);
    dibujarTodo();
}

function configurarControlesTeclado() {
    document.removeEventListener('keydown', manejarTeclado);
    document.addEventListener('keydown', manejarTeclado);
}

function manejarTeclado(evento) {
    // [AM] FIX CRÍTICO: Comparamos contra ultimaDireccion (el movimiento real del
    // último tick), NO contra direccion (que ya pudo haber cambiado este tick).
    // Esto evita que dos teclas rápidas en el mismo tick anulen el guard anti-reversa.
    switch (evento.key) {
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

function mostrarAvisoInicio() {
    alert(
        "🐍 ¡El torneo esta por comenzar!\n\n" +
        "Prepárate para jugar.\n" +
        "Come las manzanas y responde correctamente las preguntas.\n\n" +
        "⚠️ Si respondes incorrectamente, tendras una penalizacion de 3 segundos.\n\n" +
        "¡Mucha suerte!"
    );
}

function terminarJuego() {
    clearInterval(juegoIntervalo);
    juegoIntervalo = null; // [AM] FIX: nulleamos para que iniciarJuegoCulebrita
    // sepa que no hay intervalo activo en la próxima ronda
    juegoCorriendo = false;
    esperandoRespuesta = false; // [AM] Por si moría durante una pregunta pendiente

    // [AM] Si el modal seguía abierto (poco probable pero por seguridad), lo cerramos
    const modalPregunta = document.getElementById('modal-pregunta');
    if (modalPregunta) modalPregunta.style.display = 'none';

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