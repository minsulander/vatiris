import moment from "moment"
import { useAirportStore } from "@/stores/airport"
import * as turf from "@turf/turf"

export function departureDistance(pilot: any) {
    if (
        !pilot ||
        !pilot.longitude ||
        !pilot.latitude ||
        !pilot.flight_plan ||
        !pilot.flight_plan.departure
    )
        return Infinity
    const airport = useAirportStore()
    return distanceToAirport(pilot, airport.airports[pilot.flight_plan.departure])
}

export function arrivalDistance(pilot: any) {
    if (
        !pilot ||
        !pilot.longitude ||
        !pilot.latitude ||
        !pilot.flight_plan ||
        !pilot.flight_plan.arrival
    )
        return Infinity
        const airport = useAirportStore()
        return distanceToAirport(pilot, airport.airports[pilot.flight_plan.arrival])
}

export function distanceToAirport(pilot: any, airport: any) {
    if (!airport || !isFinite(airport.longitude) || !isFinite(airport.latitude)) return Infinity
    const from = turf.point([pilot.longitude, pilot.latitude])
    const to = turf.point([airport.longitude, airport.latitude])
    const distance = turf.distance(from, to) / 1.852
    return distance
}

export function flightplanArrivalTime(fp: any, adjustDepartureTime = false) {
    if (!fp || !fp.deptime || fp.deptime == "0000" || !fp.enroute_time || fp.enroute_time == "0000") return undefined
    let depHours = parseInt(fp.deptime.substring(0, 2))
    let depMinutes = parseInt(fp.deptime.substring(2, 4))
    if (adjustDepartureTime && flightplanDepartureTime(fp)?.isBefore(moment())) {
        depHours = moment().utc().get("hour")
        depMinutes = moment().utc().get("minute")
    }
    const enrHours = parseInt(fp.enroute_time.substring(0, 2))
    const enrMinutes = parseInt(fp.enroute_time.substring(2, 4))
    let arrHours = depHours + enrHours
    let arrMinutes = depMinutes + enrMinutes
    while (arrMinutes >= 60) {
        arrHours += 1
        arrMinutes -= 60
    }
    if (arrHours >= 24) arrHours -= 24
    let time = moment().utc().set("hour", arrHours).set("minute", arrMinutes)
    if (time.isBefore(moment())) time = time.add(1, "day")
    return time
}

export function flightplanDepartureTime(fp: any) {
    if (!fp ||!fp.deptime || fp.deptime == "0000" || !fp.enroute_time || fp.enroute_time == "0000") return undefined
    const depHours = parseInt(fp.deptime.substring(0, 2))
    const depMinutes = parseInt(fp.deptime.substring(2, 4))
    let time = moment().utc().set("hour", depHours).set("minute", depMinutes)
    if (time.isBefore(moment().subtract(6, "hour"))) time = time.add(1, "day")
    return time
}
