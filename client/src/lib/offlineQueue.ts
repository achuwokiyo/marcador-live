type QueuedOperation = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
  description: string;
};

const QUEUE_KEY = "marcadorlive_offline_queue";
const MAX_AGE_MS = 10 * 60 * 1000;

function getQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const ops: QueuedOperation[] = JSON.parse(raw);
    const now = Date.now();
    return ops.filter(op => now - op.createdAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full, ignore */ }
}

export function enqueueOperation(op: Omit<QueuedOperation, "id" | "createdAt">) {
  const queue = getQueue();
  queue.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  saveQueue(queue);
  console.log(`[MarcadorLIVE] Operacion guardada en cola offline: ${op.description}`);
}

export function removeOperation(id: string) {
  const queue = getQueue();
  saveQueue(queue.filter(op => op.id !== id));
}

export function getPendingCount(): number {
  return getQueue().length;
}

let flushInterval: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

async function flushQueue() {
  if (isFlushing) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  isFlushing = true;

  for (const op of queue) {
    try {
      const res = await fetch(op.url, {
        method: op.method,
        headers: op.headers,
        body: op.body,
      });
      if (res.ok || res.status === 400 || res.status === 401) {
        removeOperation(op.id);
        if (res.ok) {
          console.log(`[MarcadorLIVE] Operacion offline completada: ${op.description}`);
        } else {
          console.warn(`[MarcadorLIVE] Operacion offline rechazada (${res.status}): ${op.description}`);
        }
      } else {
        console.warn(`[MarcadorLIVE] Servidor aun no disponible (${res.status}), reintentando...`);
        break;
      }
    } catch {
      break;
    }
  }

  isFlushing = false;
}

export function startOfflineQueueProcessor() {
  if (flushInterval) return;
  flushQueue();
  flushInterval = setInterval(flushQueue, 3000);

  window.addEventListener("online", () => {
    console.log("[MarcadorLIVE] Conexion restaurada, procesando cola...");
    flushQueue();
  });
}

export function stopOfflineQueueProcessor() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}
