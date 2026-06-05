// Única conexión de socket para el jugador
const socket = io();

// Elementos del DOM del Jugador
const btnConectar = document.getElementById('btn-conectar');
const txtUsername = document.getElementById('txt-username');
const lblEstado = document.getElementById('lbl-estado');
const contenedorLobby = document.getElementById('contenedor-lobby');
const contenedorJuego = document.getElementById('contenedor-juego');
const listaRanking = document.getElementById('lista-ranking');

// 1. REGISTRO DEL JUGADOR
if (btnConectar) {
    btnConectar.addEventListener('click', () => {
        const nombre = txtUsername.value.trim();
        
        if (nombre === "") {
            alert("Debes ponerte un nombre primero.");
            return;
        }

        // Enviamos el evento exacto que espera tu server.js
        socket.emit('unirse_lobby', nombre);
        
        // Bloqueamos la interfaz
        btnConectar.disabled = true;
        txtUsername.disabled = true;
        
        if (lblEstado) {
            lblEstado.textContent = "Registrado correctamente, esperando a que el admin inicie el torneo... ⏳";
            lblEstado.style.color = "#58ff6d";
        }
    });
}

// 2. ORDEN DE ARRANQUE DESDE EL ADMIN
socket.on('start_juego', () => {
    console.log("Señal recibida, ocultando lobby y encendiendo canvas...");
    
    // Ocultar lobby y mostrar juego
    if (contenedorLobby) contenedorLobby.style.display = 'none';
    if (contenedorJuego) contenedorJuego.style.display = 'block';

    // Ocultar por seguridad el botón de volver por si quedó activo de la ronda anterior
    const btnVolver = document.getElementById('btn-volver-lobby');
    if (btnVolver) btnVolver.style.display = 'none';

    // Disparar motor de juego.js
    setTimeout(() => {
        if (typeof window.iniciarJuegoCulebrita === 'function') {
            window.iniciarJuegoCulebrita();
            window.focus(); // Truco del foco para que tome el teclado de una vez
        } else {
            console.error("Error: window.iniciarJuegoCulebrita no esta disponible.");
        }
    }, 50);
});

// 3. ACTUALIZAR RANKING EN LA PANTALLA LATERAL JUGADOR
socket.on('actualizar_ranking', (ranking) => {
    if (listaRanking) {
        listaRanking.innerHTML = '';
        ranking.forEach((jugador) => {
            const li = document.createElement('li');
            const estado = jugador.vivo ? '🐍' : '💀';
            li.innerHTML = `<strong>${jugador.username}</strong>: ${jugador.puntos} pts ${estado}`;
            listaRanking.appendChild(li);
        });
    }
});

// 4. FUNCIONES ENLACE (Llamadas desde tu juego.js)
window.notificarManzanaComida = function(nuevosPuntos) {
    socket.emit('actualizar_puntos', nuevosPuntos);
};

window.notificarMuerteJugador = function() {
    socket.emit('jugador_muerto');
};

// ==========================================
// 🔥 5. ACCIÓN: VOLVER AL LOBBY DESPUÉS DE MORIR
// ==========================================
// Este bloque escucha el botón verde que creamos en el paso anterior
const btnVolverLobby = document.getElementById('btn-volver-lobby');

if (btnVolverLobby) {
    btnVolverLobby.addEventListener('click', () => {
        console.log("🔄 El jugador presionó volver al lobby. Limpiando pantallas...");

        // 1. Intercambiamos de nuevo los contenedores visuales
        if (contenedorJuego) contenedorJuego.style.display = 'none';
        if (contenedorLobby) contenedorLobby.style.display = 'block';

        // 2. Ocultamos este mismo botón para la próxima ronda
        btnVolverLobby.style.display = 'none';

        // 3. Liberamos el botón de conectar y la caja de texto por si quieren cambiar de nombre
        if (btnConectar) btnConectar.disabled = false;
        if (txtUsername) txtUsername.disabled = false;

        // 4. Actualizamos el mensaje de estado para avisarles qué hacer
        if (lblEstado) {
            lblEstado.textContent = "Volviste al lobby. Dale 'Unirse' de nuevo para confirmar asistencia en la próxima ronda.";
            lblEstado.style.color = "#ffb703"; // Color naranja de advertencia/espera
        }
    });
}