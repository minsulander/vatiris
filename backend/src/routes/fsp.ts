import { Router, Request, Response } from "express"

const router = Router()

// In-memory storage for FSP state (could be moved to database later)
interface PrintedFlightInfo {
    timestamp: number
    squawk?: string
    route?: string
    rfl?: string
    type?: string
}

interface FspState {
    printedFlights: Record<string, PrintedFlightInfo>
    printing: boolean
    printingBy?: string // Client/user identifier
    lastUpdate: number
}

const fspState: FspState = {
    printedFlights: {},
    printing: false,
    lastUpdate: Date.now(),
}

// Clean up old printed flights periodically (older than 24 hours)
setInterval(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    let cleaned = 0
    for (const callsign in fspState.printedFlights) {
        if (fspState.printedFlights[callsign].timestamp < oneDayAgo) {
            delete fspState.printedFlights[callsign]
            cleaned++
        }
    }
    if (cleaned > 0) {
        console.log(`FSP: Cleaned ${cleaned} old flight records`)
        fspState.lastUpdate = Date.now()
    }
}, 60 * 60 * 1000) // Check every hour

// Get current FSP state
router.get("/state", (req: Request, res: Response) => {
    res.json(fspState)
})

// Mark flight as printed
router.post("/printed", (req: Request, res: Response) => {
    const { callsign, timestamp, squawk, route, rfl, type } = req.body

    if (!callsign) {
        return res.status(400).json({ error: "Callsign is required" })
    }

    fspState.printedFlights[callsign] = {
        timestamp: timestamp || Date.now(), // Use client timestamp if provided, fallback to server timestamp
        squawk,
        route,
        rfl,
        type,
    }
    fspState.lastUpdate = Date.now()

    res.json({ success: true, callsign })
})

// Set printing status (lock/unlock)
router.post("/printing", (req: Request, res: Response) => {
    const { printing, clientId } = req.body

    if (printing) {
        // Lock printing
        if (fspState.printing && fspState.printingBy !== clientId) {
            // Another client is already printing
            return res.status(409).json({
                error: "Another client is currently printing",
                printingBy: fspState.printingBy,
            })
        }
        fspState.printing = true
        fspState.printingBy = clientId
    } else {
        // Unlock printing (only if this client locked it)
        if (fspState.printingBy === clientId || !fspState.printingBy) {
            fspState.printing = false
            fspState.printingBy = undefined
        }
    }

    fspState.lastUpdate = Date.now()

    res.json({
        success: true,
        printing: fspState.printing,
        printingBy: fspState.printingBy,
    })
})

// Clear a specific printed flight
router.delete("/printed/:callsign", (req: Request, res: Response) => {
    const { callsign } = req.params

    if (callsign in fspState.printedFlights) {
        delete fspState.printedFlights[callsign]
        fspState.lastUpdate = Date.now()
        res.json({ success: true })
    } else {
        res.status(404).json({ error: "Flight not found" })
    }
})

// Clear all printed flights
router.delete("/printed", (req: Request, res: Response) => {
    fspState.printedFlights = {}
    fspState.lastUpdate = Date.now()
    res.json({ success: true })
})

export default router

