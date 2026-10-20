/**
 * Run with: npx tsx src/esggPush.test.ts  (from frontend/)
 */
import { getEsggPushLetter, matchesTypeToken } from "./esggPush"

let failed = 0

function expectEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL ${label}: got ${a}, expected ${e}`)
        failed++
    } else {
        console.log(`ok   ${label}`)
    }
}

function letter(stand: string, type: string | undefined) {
    return getEsggPushLetter(stand, type)?.letter
}

// Type token matching
expectEqual(matchesTypeToken("AT42", "AT42"), true, "AT42 exact")
expectEqual(matchesTypeToken("C526", "C525-C560"), true, "C526 in C525-C560")
expectEqual(matchesTypeToken("C550", "C525-C560"), true, "C550 in C525-C560")
expectEqual(matchesTypeToken("C560", "C525-C560"), true, "C560 in C525-C560")
expectEqual(matchesTypeToken("C56X", "C525-C560"), false, "C56X not in C525-C560")
expectEqual(matchesTypeToken("DH8C", "DH8A-DH8D"), true, "DH8C in DH8A-DH8D")
expectEqual(matchesTypeToken("CRJ7", "CRJ1-CRJ9"), true, "CRJ7 in CRJ1-CRJ9")
expectEqual(matchesTypeToken("CRJX", "CRJ1-CRJ9"), false, "CRJX not in CRJ1-CRJ9")
expectEqual(matchesTypeToken("E135", "E135/E145"), true, "E135 slash")
expectEqual(matchesTypeToken("SW4", "SW3/SW4"), true, "SW4 slash")
expectEqual(matchesTypeToken("LJ45", "LJ31-LJ60"), true, "LJ45 in LJ31-LJ60")

// Plan examples
expectEqual(letter("12", "B738"), undefined, "B738 on 12 → blank")
expectEqual(letter("23B", "B738"), "S", "B738 on 23B → S")
expectEqual(letter("5", "B738"), "N", "B738 on 5 → N")
expectEqual(letter("5", "SF34"), undefined, "SF34 on 5 → blank (PWO both ways)")
expectEqual(letter("5A", "C130"), undefined, "C130 on 5A → blank (both turns)")
expectEqual(letter("7A", "C130"), "L", "C130 on 7A → L")
expectEqual(letter("21", "A332"), "N", "Code E on 21 → N")
expectEqual(letter("30", "AT45"), "R", "AT45 on 30 → R")
expectEqual(letter("40", "D228"), undefined, "D228 on 40 → blank (both turns)")
expectEqual(letter("40", "AT72"), "L", "AT72 on 40 → L")
expectEqual(letter("56", "AT42"), "L", "AT42 on 56 → L")
expectEqual(letter("56", "AT45"), undefined, "AT45 on 56 → blank")
expectEqual(letter("70", "B738"), undefined, "B738 on 70 → blank")
expectEqual(letter("1", "B738"), "S", "Any type on 1 → S")
expectEqual(letter("1", undefined), "S", "Stand 1 without type → S")
expectEqual(letter("3", "C525"), "R", "Stand 3 → R")
expectEqual(letter("68", undefined), "N", "Stand 68 without type → N")
expectEqual(letter("23B", undefined), "S", "Stand 23B without type → S")
expectEqual(letter("5A", "B738"), "N", "B738 on 5A → N")
expectEqual(letter("46", "SF34"), "L", "SF34 on 46 → L")
expectEqual(letter("46", "B738"), undefined, "B738 on 46 → blank")
expectEqual(letter("54", "SF34"), "L", "SF34 on 54 → L")
expectEqual(letter("54", "CRJ7"), undefined, "CRJ7 on 54 excluded")
expectEqual(letter("30", "CRJX"), "R", "CRJX on 30 → R")
expectEqual(letter("30", "GL7T"), "R", "GL7T on 30 → R")
expectEqual(letter("7A", "B738"), undefined, "B738 on 7A → blank")
expectEqual(letter("22a", "B738"), undefined, "stand case normalize 22a")

if (failed > 0) {
    console.error(`\n${failed} test(s) failed`)
    process.exit(1)
}
console.log("\nAll checks passed")
