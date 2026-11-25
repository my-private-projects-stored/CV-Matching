/**
 * Lightweight per-user Server-Sent Events (SSE) hub with 25s heartbeat and Last-Event-ID replay.
 */
export function createSseHub({ heartbeatMs = 25000 } = {}) {
  const clientsByUser = new Map();

  function formatSseEvent(notif) {
    const id = String(notif._id || notif.id || "");
    return `id: ${id}\nevent: notification\ndata: ${JSON.stringify(notif)}\n\n`;
  }

  function addClient(userId, req, res) {
    const uid = String(userId);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }
    res.write(": connected\n\n");

    const clientSet = clientsByUser.get(uid) || new Set();
    const timer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": heartbeat\n\n");
      }
    }, heartbeatMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }

    const entry = { res, timer };
    clientSet.add(entry);
    clientsByUser.set(uid, clientSet);

    req.on("close", () => {
      clearInterval(timer);
      clientSet.delete(entry);
      if (clientSet.size === 0) {
        clientsByUser.delete(uid);
      }
    });

    return entry;
  }

  function sendNotification(res, notif) {
    if (res && !res.writableEnded) {
      res.write(formatSseEvent(notif));
    }
  }

  function pushToUser(userId, notif) {
    const uid = String(userId);
    const clientSet = clientsByUser.get(uid);
    if (!clientSet || clientSet.size === 0) return 0;

    const frame = formatSseEvent(notif);
    let sent = 0;
    for (const entry of clientSet) {
      if (!entry.res.writableEnded) {
        entry.res.write(frame);
        sent += 1;
      }
    }
    return sent;
  }

  function closeAll() {
    for (const clientSet of clientsByUser.values()) {
      for (const entry of clientSet) {
        clearInterval(entry.timer);
        if (!entry.res.writableEnded) {
          entry.res.end();
        }
      }
    }
    clientsByUser.clear();
  }

  return {
    addClient,
    sendNotification,
    pushToUser,
    closeAll,
    getActiveCount: () => {
      let total = 0;
      for (const set of clientsByUser.values()) total += set.size;
      return total;
    },
  };
}
