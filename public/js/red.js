
const socket = io();

// Elementos del DOM del Jugador
const btnConectar = document.getElementById('btn-conectar');
const txtUsername = document.getElementById('txt-username');
const lblEstado = document.getElementById('lbl-estado');
const contenedorLobby = document.getElementById('contenedor-lobby');
const contenedorJuego = document.getElementById('contenedor-juego');
const listaRanking = document.getElementById('lista-ranking');

if (btnConectar) {
    btnConectar.addEventListener('click', () => {
        const nombre = txtUsername.value.trim();
        
        if (nombre === "") {
            alert("Debes ponerte un nombre primero.");
            return;
        }

        socket.emit('unirse_lobby', nombre);
        
        btnConectar.disabled = true;
        txtUsername.disabled = true;
        
        if (lblEstado) {
            lblEstado.textContent = "Registrado correctamente, esperando a que el admin inicie el torneo... ⏳";
            lblEstado.style.color = "#58ff6d";
        }
    });
}

socket.on('start_juego', () => {
    console.log("Señal recibida, ocultando lobby y encendiendo canvas...");
    
    if (contenedorLobby) contenedorLobby.style.display = 'none';
    if (contenedorJuego) contenedorJuego.style.display = 'block';

    const btnVolver = document.getElementById('btn-volver-lobby');
    if (btnVolver) btnVolver.style.display = 'none';

    setTimeout(() => {
        if (typeof window.iniciarJuegoCulebrita === 'function') {
            window.iniciarJuegoCulebrita();
            window.focus(); 
        } else {
            console.error("Error: window.iniciarJuegoCulebrita no esta disponible.");
        }
    }, 50);
});

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

const btnVolverLobby = document.getElementById('btn-volver-lobby');

if (btnVolverLobby) {
    btnVolverLobby.addEventListener('click', () => {
        console.log("🔄 El jugador presionó volver al lobby. Limpiando pantallas...");

        if (contenedorJuego) contenedorJuego.style.display = 'none';
        if (contenedorLobby) contenedorLobby.style.display = 'block';

        btnVolverLobby.style.display = 'none';

        if (btnConectar) btnConectar.disabled = false;
        if (txtUsername) txtUsername.disabled = false;

        if (lblEstado) {
            lblEstado.textContent = "Volviste al lobby. Dale 'Unirse' de nuevo para confirmar asistencia en la próxima ronda.";
            lblEstado.style.color = "#ffb703"; // Color naranja de advertencia/espera
        }
    });
}