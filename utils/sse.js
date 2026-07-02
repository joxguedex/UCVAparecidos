'use strict';

/**
 * Manejador global de Server-Sent Events (SSE).
 */
class SSEManager {
  constructor() {
    this.clients = new Set();
  }

  addClient(req, res) {
    // Configurar cabeceras necesarias para SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    res.write('\n'); // Mantener conexión viva al inicio

    this.clients.add(res);

    // Cuando el cliente se desconecta (cierra pestaña, recarga), eliminarlo
    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(message);
    }
  }
}

const sse = new SSEManager();
module.exports = sse;
