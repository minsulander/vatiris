import type { Server as HttpServer } from "http"
import { WebSocketServer, WebSocket } from "ws"
import { EFS_REALMS, EfsRealm } from "./types"
import * as store from "./store"

function parseRealm(raw: string): EfsRealm | undefined {
    const r = String(raw || "").toLowerCase() as EfsRealm
    return EFS_REALMS.includes(r) ? r : undefined
}

/**
 * Attach WS at /efs/sync/:realm/:airport/ws?cid=
 */
export function attachEfsSyncWebSocket(server: HttpServer) {
    const wss = new WebSocketServer({ noServer: true })

    server.on("upgrade", (req, socket, head) => {
        try {
            const url = new URL(req.url || "", "http://localhost")
            const m = url.pathname.match(/^\/efs\/sync\/([^/]+)\/([^/]+)\/ws\/?$/i)
            if (!m) {
                socket.destroy()
                return
            }
            const realm = parseRealm(m[1])
            const airport = String(m[2] || "").toUpperCase()
            if (!realm || !/^[A-Z]{4}$/.test(airport)) {
                socket.write("HTTP/1.1 400 Bad Request\r\n\r\n")
                socket.destroy()
                return
            }
            const cidRaw = url.searchParams.get("cid")
            const cid = Number(cidRaw)
            if (!cidRaw || !Number.isFinite(cid) || cid <= 0) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
                socket.destroy()
                return
            }

            wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
                store.addClient(realm, airport, ws)
                ws.on("close", () => store.removeClient(realm, airport, ws))
                ws.on("error", () => store.removeClient(realm, airport, ws))
                // Clients may send pings as text; ignore
                ws.on("message", () => {})
            })
        } catch {
            try {
                socket.destroy()
            } catch {
                /* ignore */
            }
        }
    })

    return wss
}
