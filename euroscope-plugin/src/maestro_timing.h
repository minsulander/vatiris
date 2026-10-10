#pragma once
#include "json.hpp"
#include <cmath>
#include <optional>

inline std::optional<int> MaestroInstructionSeconds(const nlohmann::json& flight) {
    try {
        double seconds;
        if (flight.contains("deltaSeconds")) {
            if (!flight.at("deltaSeconds").is_number()) return std::nullopt;
            seconds = flight.at("deltaSeconds").get<double>();
        } else {
            // Compatibility with older timing writers only. The declared
            // instruction is authoritative, including an explicit zero.
            seconds = (flight.at("sta").get<double>() - flight.at("eta").get<double>()) / 1000.0;
        }
        if (!std::isfinite(seconds) || std::abs(seconds) > 86400) return std::nullopt;
        return static_cast<int>(std::round(seconds));
    } catch (...) { return std::nullopt; }
}
