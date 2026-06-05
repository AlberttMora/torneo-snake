const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg'); // 🔥 Cambiamos sqlite3 por pg (PostgreSQL)

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.nntsiwtzakugdqtgejtp:D+A13092022d+a@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

db.query(`
    CREATE TABLE IF NOT EXISTS ranking (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        max_puntaje INT DEFAULT 0,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`, (err, res) => {
    if (err) {
        console.error("Error conectando o creando tabla en PostgreSQL:", err.message);
    } else {
        console.log("Conectado con éxito a PostgreSQL. Tabla 'ranking' lista.");
    }
});

let jugadores = {}; 

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`🔌 Nuevo dispositivo conectado: ${socket.id}`);

    socket.on('unirse_lobby', async (username) => {
        jugadores[socket.id] = { username: username, puntos: 0, vivo: true };
        console.log(`📝 Jugador registrado: ${username}`);

        try {
            await db.query(
                `INSERT INTO ranking (username, max_puntaje) VALUES ($1, 0) ON CONFLICT (username) DO NOTHING`,
                [username]
            );
        } catch (err) {
            console.error("Error BD al registrar:", err.message);
        }

        enviarRankingActualizado();
    });

    socket.on('actualizar_puntos', async (nuevosPuntos) => {
        if (jugadores[socket.id]) {
            jugadores[socket.id].puntos = nuevosPuntos;
            const username = jugadores[socket.id].username;

            try {
                await db.query(`
                    UPDATE ranking 
                    SET max_puntaje = $1 
                    WHERE username = $2 AND $1 > max_puntaje
                `, [nuevosPuntos, username]);
            } catch (err) {
                console.error("Error al actualizar puntos en BD:", err.message);
            }

            enviarRankingActualizado();
        }
    });

    socket.on('jugador_muerto', () => {
        if (jugadores[socket.id]) {
            jugadores[socket.id].vivo = false;
            enviarRankingActualizado();
        }
    });

    socket.on('reentrar_lobby', () => {
        if (jugadores[socket.id]) {
            jugadores[socket.id].puntos = 0;
            jugadores[socket.id].vivo = true;
            enviarRankingActualizado();
        }
    });

    socket.on('admin_iniciar_torneo', () => {
        for (let id in jugadores) {
            jugadores[id].puntos = 0;
            jugadores[id].vivo = true;
        }
        io.emit('start_juego'); 
        enviarRankingActualizado();
    });
    socket.on('obtener_historial_bd', async () => {
        try {
            const resultado = await db.query(`SELECT username, max_puntaje FROM ranking ORDER BY max_puntaje DESC LIMIT 10`);
            socket.emit('enviar_historial_bd', resultado.rows);
        } catch (err) {
            console.error("Error al obtener historial de Postgres:", err.message);
        }
    });

    socket.on('disconnect', () => {
        if (jugadores[socket.id]) {
            delete jugadores[socket.id];
            enviarRankingActualizado();
        }
    });
});

function enviarRankingActualizado() {
    const listaRanking = Object.values(jugadores).sort((a, b) => b.puntos - a.puntos);
    io.emit('actualizar_ranking', listaRanking);
}

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});