#include "plugin.h"
#include "Version.h"
#include "maestro_timing.h"
#include "maestro_broadcast.h"
#include "postjson.h"

#include "json.hpp"
#include <chrono>
#include <cmath>
#include <format>
#include <fstream>
#include <regex>
#include <sstream>
#include <string>
#include <windows.h>
#include <wininet.h>

#pragma comment(lib, "wininet.lib")

namespace VatIRIS
{

extern "C" IMAGE_DOS_HEADER __ImageBase;
char DllPathFile[_MAX_PATH];


VatIRISPlugin::VatIRISPlugin()
: CPlugIn(EuroScopePlugIn::COMPATIBILITY_CODE, PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR, PLUGIN_LICENSE)
{
    lastPostTime = std::time(NULL);
    disabled = true; // ... until connected - see OnTimer
    updateAll = false;
    debug = false;
    RegisterTagItemType("MAESTRO Current delay (G/L)", 70001);
    RegisterTagItemType("MAESTRO TTG (gain)", 70002);
    RegisterTagItemType("MAESTRO TTL (lose)", 70003);
    mutex = CreateMutex(NULL, FALSE, NULL);

    GetModuleFileNameA(HINSTANCE(&__ImageBase), DllPathFile, sizeof(DllPathFile));
    std::string settingsPath = DllPathFile;
    settingsPath.resize(settingsPath.find_last_of("\\/")+1);
    settingsPath += "VatIRISPlugin.txt";
    std::ifstream settingsFile(settingsPath);
    if (settingsFile.is_open()) {
        std::string line;
        while (std::getline(settingsFile, line)) {
            if (line.empty()) continue;
            for (auto &c : line)
                c = (char)std::tolower(c);
            if (line == "debug")
                debug = true;
            else if (line == "updateall")
                updateAll = true;
            else
                DisplayMessage("Unknown setting: " + line);
        }
    }
    DebugMessage("Version " + std::string(PLUGIN_VERSION) + (updateAll ? " updateAll" : ""));
}

VatIRISPlugin::~VatIRISPlugin()
{
    if (mutex) {
        WaitForSingleObject(mutex, INFINITE); // Wait for any ongoing operations
        pendingUpdates.clear(); // Clear any pending updates
        ReleaseMutex(mutex);
        CloseHandle(mutex);
        mutex = NULL;
    }
}

void VatIRISPlugin::OnFlightPlanFlightPlanDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    try {
        if (disabled || !FilterFlightPlan(FlightPlan)) return;

        std::string callsign = FlightPlan.GetCallsign();
        if (callsign.empty() || callsign.length() > 20) {
            DisplayMessage("OnFlightPlanFlightPlanDataUpdate: Invalid callsign");
            return;
        }

        EuroScopePlugIn::CFlightPlanData fpData = FlightPlan.GetFlightPlanData();
        if (!fpData.IsReceived()) {
            DebugMessage("Invalid flight plan data");
            return;
        }

        std::stringstream out;
        out << "FlightPlanDataUpdate " << callsign;
        
        // Safe state checks
        int state = FlightPlan.GetState();
        int fpstate = FlightPlan.GetFPState();
        if (state >= 0 && state <= 10 && fpstate >= 0 && fpstate <= 10) {
            out << " state " << state << " fpstate " << fpstate;
        }

        if (FlightPlan.GetSimulated()) out << " simulated";

        const char* trackingController = FlightPlan.GetTrackingControllerCallsign();
        if (trackingController && strlen(trackingController) > 0 && strlen(trackingController) < 20) {
            out << " controller " << trackingController;
        }

        // int ete = FlightPlan.GetPositionPredictions().GetPointsNumber();
        // if (ete >= 0 && ete <= 1000) { // Reasonable ETE range
        //     out << " ete " << ete;
        // }

        DebugMessage(out.str());
        UpdateRoute(FlightPlan);
    } catch (const std::exception &e) {
        DisplayMessage(std::string("OnFlightPlanFlightPlanDataUpdate exception: ") + e.what());
    } catch (...) {
        DisplayMessage("OnFlightPlanFlightPlanDataUpdate: Unknown exception");
    }
}

void VatIRISPlugin::OnFlightPlanControllerAssignedDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan, int DataType)
{
    try {
        if (disabled || !FilterFlightPlan(FlightPlan)) return;

        std::string callsign = FlightPlan.GetCallsign();
        if (callsign.empty() || callsign.length() > 20) {
            DisplayMessage("OnFlightPlanControllerAssignedDataUpdate: Invalid callsign");
            return;
        }

        if (DataType < EuroScopePlugIn::CTR_DATA_TYPE_SQUAWK || 
            DataType > EuroScopePlugIn::CTR_DATA_TYPE_DIRECT_TO) {
            DebugMessage("Invalid DataType received: " + std::to_string(DataType));
            return;
        }

        const char *controllerCallsign = FlightPlan.GetTrackingControllerCallsign();
        if (controllerCallsign && strlen(controllerCallsign) > 0 && strlen(controllerCallsign) < 20) {
            pendingUpdates[callsign]["controller"] = controllerCallsign;
        }

        const EuroScopePlugIn::CFlightPlanControllerAssignedData ctrData = FlightPlan.GetControllerAssignedData();

        std::stringstream out;
        out << "ControllerAssignedDataUpdate " << callsign;
        if (controllerCallsign && strlen(controllerCallsign) > 0)
            out << " controller " << controllerCallsign;

        switch (DataType) {
        case EuroScopePlugIn::CTR_DATA_TYPE_SQUAWK: {
            const char* squawk = ctrData.GetSquawk();
            if (squawk && strlen(squawk) == 4) { // Valid squawk is always 4 digits
                out << " squawk " << squawk;
                pendingUpdates[callsign]["squawk"] = squawk;
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_FINAL_ALTITUDE: {
            int rfl = ctrData.GetFinalAltitude();
            if (rfl >= 0 && rfl <= 100000) { // Reasonable altitude range
                out << " rfl " << rfl;
                pendingUpdates[callsign]["rfl"] = rfl;
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_TEMPORARY_ALTITUDE: {
            int cfl = ctrData.GetClearedAltitude();
            out << " cfl " << cfl;
            pendingUpdates[callsign]["cfl"] = cfl;
            // 0 - no cleared level (use the final instead of)
            // 1 - cleared for ILS approach
            // 2 - cleared for visual approach
            if (cfl == 1 || cfl == 2) {
                pendingUpdates[callsign]["ahdg"] = 0;
                pendingUpdates[callsign]["direct"] = "";
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_COMMUNICATION_TYPE:
            out << " comm " << ctrData.GetCommunicationType();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_SCRATCH_PAD_STRING: {
            const char* scratchStr = ctrData.GetScratchPadString();
            if (!scratchStr || strlen(scratchStr) == 0) return;
            
            // Limit scratch pad string length
            if (strlen(scratchStr) > 50) {
                DebugMessage("Scratch pad string too long: " + std::string(scratchStr));
                return;
            }
            
            std::string scratch = scratchStr;
            out << " scratch " << scratch;
            
            // Safe string comparisons
            if (scratch == "LINEUP" || scratch == "ONFREQ" || scratch == "DE-ICE") {
                pendingUpdates[callsign]["groundstate"] = scratch;
            } else if (scratch.length() > 6 && scratch.find("GRP/S/") != std::string::npos) {
                // Ensure we have enough characters for substr(6)
                pendingUpdates[callsign]["stand"] = scratch.substr(6);
            }
            // Scratch pad inputs noticed in the wild (if we ever want to
            // reverse-engineer/understand some TopSky plugin features): /PRESHDG/ /ASP=/ /ASP+/
            // /ASP-/ /ES /C_FLAG_ACK/ /C_FLAG_RESET/ MISAP_ /ROF/SAS525/ESMM_5_CTR
            // /LAM/ROF/ESMM_5_CTR
            // /ROF/RYR6Q/EKCH_F_APP
            // /COB
            // /PLU
            // /TIT
            // /OPTEXT2_REQ/ESMM_7_CTR/LHA3218/NC M7
            // /SBY/RTI/EDDB_S_APP/S290+
            // /ACP/RTI/EDDB_S_APP
            // SAS88J controller ESMM_2_CTR scratch /RTI/DLH6RA/ESMM_2_CTR/S074-
            // DLH6RA controller EKDK_CTR scratch /SBY/RTI/ESMM_2_CTR/S074-
            // DLH6RA controller EKDK_CTR scratch /ACP/RTI/ESMM_2_CTR
            // DLH6RA controller EKDK_CTR mach 74
            // DLH6RA controller EKDK_CTR scratch /ASP-/
            // /OPTEXT2_REQ/ESSA_M_APP/NRD1121/"NORTH RIDER"
            // /FTEXT/L0
            // /HOLD/ERNOV/
            // /XHOLD/ERNOV/
            // /HOLD//0
            // /ARC+/
            // /ACK_STAR/RISMA3S
            // /OPTEXT/TEST
            // /OPTEXT/
            // /CAT2/
            // /CAT3/
            // ON_CONTACT+
            // ON_CONTACT-
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_GROUND_STATE:
            out << " groundstate " << FlightPlan.GetGroundState();
            pendingUpdates[callsign]["groundstate"] = FlightPlan.GetGroundState();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_CLEARENCE_FLAG:
            out << " clearance " << FlightPlan.GetClearenceFlag();
            pendingUpdates[callsign]["clearence"] = (bool)FlightPlan.GetClearenceFlag();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_DEPARTURE_SEQUENCE:
            out << " dsq"; // TODO where dis dsq?
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_SPEED: {
            int speed = ctrData.GetAssignedSpeed();
            if (speed >= 0 && speed <= 1500) { // Reasonable speed range
                out << " asp " << speed;
                pendingUpdates[callsign]["asp"] = speed;
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_MACH: {
            double mach = ctrData.GetAssignedMach();
            if (mach >= 0.0 && mach <= 10.0) { // Reasonable mach range
                out << " mach " << mach;
                pendingUpdates[callsign]["mach"] = mach;
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_RATE: {
            int rate = ctrData.GetAssignedRate();
            if (rate >= -50000 && rate <= 50000) { // Reasonable rate range
                out << " arc " << rate;
                pendingUpdates[callsign]["arc"] = rate;
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_HEADING: {
            int heading = ctrData.GetAssignedHeading();
            if (heading >= 0 && heading <= 360) { // Valid heading range
                out << " ahdg " << heading;
                pendingUpdates[callsign]["ahdg"] = heading;
                pendingUpdates[callsign]["direct"] = "";
            }
            break;
        }
        case EuroScopePlugIn::CTR_DATA_TYPE_DIRECT_TO: {
            const char* directTo = ctrData.GetDirectToPointName();
            if (directTo && strlen(directTo) > 0 && strlen(directTo) < 50) { // Reasonable waypoint name length
                out << " direct " << directTo;
                pendingUpdates[callsign]["direct"] = directTo;
                pendingUpdates[callsign]["ahdg"] = 0;
            }
            break;
        }
        }
        // for (int i = 0; i < 9; i++) {
        //     const char* annotation = ctrData.GetFlightStripAnnotation(i);
        //     if (annotation && strlen(annotation) > 0 && strlen(annotation) < 50) { // Reasonable length limit
        //         out << " a" << i << " " << annotation;
        //     }
        // }
        DebugMessage(out.str());
        UpdateRoute(FlightPlan);
    } catch (const std::exception &e) {
        DisplayMessage(std::string("OnFlightPlanControllerAssignedDataUpdate exception: ") + e.what());
    } catch (...) {
        DisplayMessage("OnFlightPlanControllerAssignedDataUpdate: Unknown exception");
    }
}

void VatIRISPlugin::OnFlightPlanDisconnect(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    if (disabled || !FilterFlightPlan(FlightPlan)) return;
    // TODO remove not really useful
    // std::stringstream out;
    // out << "FlightPlanDisconnect " << FlightPlan.GetCallsign();
    // DebugMessage(out.str());
}

bool VatIRISPlugin::OnCompileCommand(const char *commandLine)
{
    if (strcmp(commandLine,".vatiris maestro")==0) {
        DisplayMessage(std::string("AMAN timing: ")+(std::time(nullptr)-maestroLoadedAt<=15?"fresh":"missing/stale")+
            "; TopSky/MAESTRO receivers: "+std::to_string(maestroReceivers));
        return true;
    }
    if (strncmp(commandLine, ".vatiris all", 12) == 0) {
        DisplayMessage("Updating all flight plans");
        updateAll = true;
        return true;
    } else if (strncmp(commandLine, ".vatiris mine", 13) == 0) {
        DisplayMessage("Updating my flight plans");
        updateAll = false;
        return true;
    } else if (strncmp(commandLine, ".vatiris debug", 14) == 0) {
        DisplayMessage("Debug mode enabled");
        debug = true;
        return true;
    } else if (strncmp(commandLine, ".vatiris test", 13) == 0) {
        std::stringstream out;
        out << "me " << ControllerMyself().GetCallsign();
        out << " " << ControllerMyself().GetPositionId();
        out << " " << ControllerMyself().GetFullName();
        out << " " << ControllerMyself().GetPrimaryFrequency();
        out << " " << ControllerMyself().GetSectorFileName();
        DisplayMessage(out.str());
        return true;
    }
    return false;
}

void VatIRISPlugin::OnTimer(int counter)
{
    if (counter % 2 == 0) {LoadMaestroTiming();BroadcastMaestroSequence();}
    if (counter % 5 == 0) ExportMaestroTelemetry();
    try {
        if (disabled && GetConnectionType() == EuroScopePlugIn::CONNECTION_TYPE_DIRECT) {
            disabled = false;
            enabledTime = std::time(NULL);
            DebugMessage("VatIRIS updates enabled");
        } else if (!disabled && GetConnectionType() != EuroScopePlugIn::CONNECTION_TYPE_DIRECT) {
            disabled = true;
            DebugMessage("VatIRIS updates disabled");
            return;
        } else if (disabled) {
            return;
        }

        if (std::time(NULL) - enabledTime < 10) return;
        if (counter % 30 == 0) UpdateMyself();
        if (pendingUpdates.empty()) return;
        if (std::time(NULL) - lastPostTime < (5 + (std::rand() % 10))) return;
        PostUpdates();
    } catch (const std::exception &e) {
        DisplayMessage(std::string("OnTimer exception: ") + e.what());
    } catch (...) {
        DisplayMessage("OnTimer: Unknown exception");
    }
}

void VatIRISPlugin::LoadMaestroTiming()
{
    // File I/O stays out of the tag drawing callback. Bridge writes atomically.
    maestroTiming = nlohmann::json::object();
    maestroLoadedAt = 0;
    try {
        std::string file = DllPathFile;
        file = file.substr(0, file.find_last_of("\\/") + 1) + "MAESTROTiming.json";
        std::ifstream stream(file, std::ios::binary | std::ios::ate);
        if (!stream || stream.tellg() > 1048576) return;
        stream.seekg(0);
        nlohmann::json data;
        stream >> data;
        const auto generated = data.at("generatedAt").get<long long>() / 1000;
        const auto age = static_cast<long long>(std::time(nullptr)) - generated;
        if (data.at("airport") != "ESSA" || age < -5 || age > 15 ||
            !data.at("flights").is_array() || data.at("flights").size() > 500) return;
        for (const auto &flight : data.at("flights")) {
            const auto callsign = flight.at("callsign").get<std::string>();
            const auto instruction = MaestroInstructionSeconds(flight);
            if (callsign.empty() || callsign.size() > 16 || !instruction) continue;
            maestroTiming[callsign] = *instruction;
        }
        maestroLoadedAt = static_cast<std::time_t>(generated);
        if(data.contains("nativeSequence")) {
            const auto& sequence=data.at("nativeSequence");
            if(sequence.at("data").at("icao")=="ESSA" && sequence.at("sequence").is_array() && sequence.at("sequence").size()<=500)
                maestroSequence=sequence;
        } else if(maestroSequence.is_object()) {
            maestroSequence["sequence"]=nlohmann::json::array();
            maestroSequence["data"]["timestamp"]=generated;
            maestroSequence["data"]["source"]="EMPTY";
        }
    } catch (...) { maestroTiming.clear(); }
}

void VatIRISPlugin::BroadcastMaestroSequence()
{
    try {
        if(!maestroSequence.is_object())return;
        auto outgoing=maestroSequence;
        if(std::time(nullptr)-maestroLoadedAt>15) {
            outgoing["sequence"]=nlohmann::json::array();
            outgoing["data"]["source"]="STALE";
            outgoing["data"]["timestamp"]=static_cast<long long>(std::time(nullptr));
        }
        maestroReceivers=MaestroBroadcastSequence(outgoing.dump());
    }catch(...){maestroReceivers=0;}
}

void VatIRISPlugin::OnGetTagItem(EuroScopePlugIn::CFlightPlan FlightPlan, EuroScopePlugIn::CRadarTarget,
    int ItemCode, int, char sItemString[16], int *pColorCode, COLORREF *pRGB, double *)
{
    if (ItemCode < 70001 || ItemCode > 70003) return;
    sItemString[0] = '\0';
    if (pColorCode) *pColorCode = EuroScopePlugIn::TAG_COLOR_DEFAULT;
    if (!FlightPlan.IsValid() || std::time(nullptr) - maestroLoadedAt > 15) return;
    const auto fp = FlightPlan.GetFlightPlanData();
    if (!fp.IsReceived() || !fp.GetDestination() || strcmp(fp.GetDestination(), "ESSA") != 0) return;
    const auto found = maestroTiming.find(FlightPlan.GetCallsign());
    if (found == maestroTiming.end()) return;
    const int delta = found->get<int>();
    if ((ItemCode == 70002 && delta >= 0) || (ItemCode == 70003 && delta <= 0)) return;
    const int minutes = static_cast<int>(std::round(std::abs(delta) / 60.0));
    if (minutes == 0) return;
    sprintf_s(sItemString, 16, "%s%d", delta < 0 ? "-" : "", minutes);
    if (pColorCode && pRGB) {
        *pColorCode = EuroScopePlugIn::TAG_COLOR_RGB_DEFINED;
        *pRGB = delta < 0 ? RGB(41,255,40) : minutes < 3 ? RGB(240,225,41) : RGB(225,25,25);
    }
}

void VatIRISPlugin::OnNewMetarReceived(const char *station, const char *metar)
{
    if (!station || !metar || (std::string(station) != "ESSA" && std::string(station) != "ESSB")) return;
    try {
        std::cmatch match;
        static const std::regex wind(R"((?:^|\s)([0-9]{3}|VRB)([0-9]{2,3})(?:G[0-9]{2,3})?(KT|MPS)(?:\s|$))");
        if (!std::regex_search(metar, match, wind)) return;
        const int direction = match[1].str() == "VRB" ? 0 : std::stoi(match[1].str());
        const double speed = std::stod(match[2].str()) * (match[3].str() == "MPS" ? 1.943844 : 1.0);
        maestroWinds[station] = { {"direction", direction}, {"speed", speed},
            {"timestamp", static_cast<long long>(std::time(nullptr)) * 1000} };
    } catch (...) { }
}

void VatIRISPlugin::ExportMaestroTelemetry()
{
    try {
        nlohmann::json data = { {"source", ControllerMyself().IsValid() ? ControllerMyself().GetCallsign() : "OFFLINE"},
            {"timestamp", static_cast<long long>(std::time(nullptr)) * 1000}, {"flights", nlohmann::json::array()}, {"winds", maestroWinds} };
        nlohmann::json runwayGeometry = nlohmann::json::object();
        for (auto runway = SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY); runway.IsValid();
            runway = SectorFileElementSelectNext(runway, EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY)) {
            const auto airport = runway.GetAirportName();
            if (!airport || (std::string(airport) != "ESSA" && std::string(airport) != "ESSB")) continue;
            for (int end = 0; end < 2; end++) {
                EuroScopePlugIn::CPosition threshold, opposite;
                const auto name = runway.GetRunwayName(end);
                if (!name || !*name || !runway.GetPosition(&threshold, end) || !runway.GetPosition(&opposite, 1-end)) continue;
                const double pi = 3.141592653589793, a = threshold.m_Latitude*pi/180, b = opposite.m_Latitude*pi/180;
                const double delta = (opposite.m_Longitude-threshold.m_Longitude)*pi/180;
                const double bearing = std::fmod(std::atan2(std::sin(delta)*std::cos(b), std::cos(a)*std::sin(b)-std::sin(a)*std::cos(b)*std::cos(delta))*180/pi+360,360);
                runwayGeometry[std::string(airport)+"/"+name] = { {"latitude",threshold.m_Latitude}, {"longitude",threshold.m_Longitude}, {"heading",bearing} };
            }
        }
        data["runways"] = runwayGeometry;
        if (GetConnectionType() != EuroScopePlugIn::CONNECTION_TYPE_NO) {
            int count = 0;
            for (auto fp = FlightPlanSelectFirst(); fp.IsValid() && count < 1000; fp = FlightPlanSelectNext(fp)) {
                const auto fpd = fp.GetFlightPlanData();
                if (!fpd.IsReceived() || !fpd.GetDestination()) continue;
                const std::string arrival = fpd.GetDestination();
                if (arrival != "ESSA" && arrival != "ESSB") continue;
                const auto target = fp.GetCorrelatedRadarTarget();
                if (!target.IsValid()) continue;
                const auto position = target.GetPosition();
                if (position.GetReceivedTime() > 30) continue;
                const auto route = fp.GetExtractedRoute();
                const int points = route.GetPointsNumber();
                if (points < 1 || points > 1000) continue;
                nlohmann::json prediction = nlohmann::json::array();
                for (int i = 0; i < points; i++) {
                    const char *name = route.GetPointName(i);
                    if (!name || strlen(name) > 40) continue;
                    const auto point = route.GetPointPosition(i);
                    prediction.push_back({ {"name", name}, {"seconds", route.GetPointDistanceInMinutes(i) * 60},
                        {"latitude",point.m_Latitude}, {"longitude",point.m_Longitude} });
                }
                const auto ctr = fp.GetControllerAssignedData();
                const int assigned = route.GetPointsAssignedIndex();
                const int calculated = route.GetPointsCalculatedIndex();
                const std::string problem = assigned >= 0 && calculated >= 0 && assigned < calculated ?
                    "Assigned direct-to is behind the current route position" : "";
                const auto callsign = fp.GetCallsign();
                if (!callsign || strlen(callsign) > 16) continue;
                const auto coordinates = position.GetPosition();
                data["flights"].push_back({ {"callsign", callsign}, {"aircraft", fpd.GetAircraftFPType()},
                    {"wake", std::string(1, fpd.GetAircraftWtc())}, {"departure", fpd.GetOrigin()}, {"arrival", arrival},
                    {"runway", fpd.GetArrivalRwy()}, {"route", prediction},
                    {"star",fpd.GetStarName()?fpd.GetStarName():""}, {"routeText",std::string(fpd.GetRoute()?fpd.GetRoute():"").substr(0,4096)},
                    {"assignedSpeed",ctr.GetAssignedSpeed()}, {"verticalSpeed",target.GetVerticalSpeed()},
                    {"landingSeconds", route.GetPointDistanceInMinutes(points - 1) * 60},
                    {"distanceNm", fp.GetDistanceToDestination()}, {"groundspeed", position.GetReportedGS()},
                    {"altitude", position.GetPressureAltitude()}, {"heading", position.GetReportedHeadingTrueNorth()},
                    {"assignedHeading", ctr.GetAssignedHeading()}, {"direct", ctr.GetDirectToPointName()}, {"routeProblem", problem},
                    {"latitude",coordinates.m_Latitude}, {"longitude",coordinates.m_Longitude},
                    {"positionAgeSeconds",position.GetReceivedTime()}, {"calculatedRouteIndex",calculated} });
                const std::string runwayKey=arrival+"/"+fpd.GetArrivalRwy();
                if (runwayGeometry.contains(runwayKey)) data["flights"].back()["threshold"]=runwayGeometry[runwayKey];
                count++;
            }
        }
        std::string file = DllPathFile;
        file = file.substr(0, file.find_last_of("\\/") + 1) + "MAESTROTelemetry.json";
        const std::string temp = file + ".tmp";
        { std::ofstream out(temp, std::ios::binary | std::ios::trunc); if (!out) return; out << data.dump(); if (!out) return; }
        MoveFileExA(temp.c_str(), file.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
    } catch (...) { /* Invalid predictions must not interrupt the radar. */ }
}

void VatIRISPlugin::UpdateMyself()
{
    try {
        // Limit the size of controller updates
        if (pendingUpdates.size() > 1000) {
            DebugMessage("Too many pending updates in UpdateMyself");
            pendingUpdates.clear();
        }

        EuroScopePlugIn::CController me = ControllerMyself();
        if (!me.IsValid()) {
            DebugMessage("UpdateMyself: Controller not valid");
            return;
        }

        std::string callsign = me.GetCallsign();
        if (callsign.empty() || callsign.length() > 20) {
            DebugMessage("UpdateMyself: Invalid callsign");
            return;
        }

        // Validate and limit controller data
        const char *fullName = me.GetFullName();
        if (fullName && *fullName && strlen(fullName) < 50) {
            pendingUpdates[callsign]["name"] = fullName;
        }

        double frequency = me.GetPrimaryFrequency();
        if (frequency >= 100.0 && frequency <= 200.0) {
            pendingUpdates[callsign]["frequency"] = frequency;
        }

        pendingUpdates[callsign]["controller"] = me.IsController();
        pendingUpdates[callsign]["pluginVersion"] = PLUGIN_VERSION;

        // Limit the size of the rwyconfig structure
        nlohmann::json& rwyconfig = pendingUpdates[callsign]["rwyconfig"];
        if (rwyconfig.size() > 100) {
            DebugMessage("Too many airports in rwyconfig");
            rwyconfig.clear();
        }

        SelectActiveSectorfile();

        // Safe airport iteration with count limit
        int airportCount = 0;
        const int MAX_AIRPORTS = 1000;
        for (EuroScopePlugIn::CSectorElement airport =
             SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_AIRPORT);
             airport.IsValid() && airportCount < MAX_AIRPORTS;
             airport = SectorFileElementSelectNext(airport, EuroScopePlugIn::SECTOR_ELEMENT_AIRPORT)) {
            
            airportCount++;
            const char *airportName = airport.GetName();
            if (!airportName || !*airportName || strlen(airportName) > 10) continue;

            std::string airportStr = airportName;
            airportStr.erase(std::remove_if(airportStr.begin(), airportStr.end(), ::isspace), airportStr.end());
            if (airportStr.empty()) continue;

            if (airport.IsElementActive(false))
                rwyconfig[airportStr]["arr"] = true;
            if (airport.IsElementActive(true))
                rwyconfig[airportStr]["dep"] = true;
        }

        // Safe runway iteration with count limit
        int runwayCount = 0;
        const int MAX_RUNWAYS = 1000;
        EuroScopePlugIn::CSectorElement runway = SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY);
        if (!runway.IsValid()) {
            return;
        }

        do {
            runwayCount++;
            const char *airportName = runway.GetAirportName();
            if (!airportName || !*airportName || strlen(airportName) > 10) continue;

            std::string airport = airportName;
            airport.erase(std::remove_if(airport.begin(), airport.end(), ::isspace), airport.end());
            if (airport.empty()) continue;

            const char *rwyName0 = runway.GetRunwayName(0);
            const char *rwyName1 = runway.GetRunwayName(1);

            // Validate runway names
            if (rwyName0 && *rwyName0 && strlen(rwyName0) <= 5) {
                if (runway.IsElementActive(false, 0))
                    rwyconfig[airport][rwyName0]["arr"] = true;
                if (runway.IsElementActive(true, 0))
                    rwyconfig[airport][rwyName0]["dep"] = true;
            }

            if (rwyName1 && *rwyName1 && strlen(rwyName1) <= 5) {
                if (runway.IsElementActive(false, 1))
                    rwyconfig[airport][rwyName1]["arr"] = true;
                if (runway.IsElementActive(true, 1))
                    rwyconfig[airport][rwyName1]["dep"] = true;
            }

            runway = SectorFileElementSelectNext(runway, EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY);
        } while (runway.IsValid() && runwayCount < MAX_RUNWAYS);

    } catch (const std::exception &e) {
        DisplayMessage(std::string("UpdateMyself exception: ") + e.what());
        // Clear updates on error to prevent corrupted state
        pendingUpdates.clear();
    } catch (...) {
        DisplayMessage("UpdateMyself: Unknown exception");
        // Clear updates on error to prevent corrupted state
        pendingUpdates.clear();
    }
}

void VatIRISPlugin::PostUpdates()
{
    lastPostTime = std::time(NULL);
    if (!mutex) {
        DisplayMessage("Mutex not initialized");
        return;
    }

    DWORD waitResult = WaitForSingleObject(mutex, 1000);
    if (waitResult == WAIT_TIMEOUT) {
        DebugMessage("Post thread is busy");
        return;
    }
    if (waitResult != WAIT_OBJECT_0) {
        DisplayMessage("Failed to acquire mutex");
        return;
    }

    try {
        // Limit the size of updates to prevent memory issues
        const size_t MAX_UPDATES = 1000;
        if (pendingUpdates.size() > MAX_UPDATES) {
            DebugMessage("Too many pending updates, clearing old ones");
            pendingUpdates.clear();
            ReleaseMutex(mutex);
            return;
        }

        auto updates = pendingUpdates;
        pendingUpdates.clear();
        DebugMessage("Posting updates " + std::to_string(updates.size()));

        ThreadData *data = new ThreadData{ "backend.vatiris.se", "esdata", std::move(updates) };
        HANDLE thread = CreateThread(NULL, 0, PostJson, data, 0, NULL);
        if (!thread) {
            delete data;
            DisplayMessage("Failed to create post thread");
            ReleaseMutex(mutex);
            return;
        }
        CloseHandle(thread);
    } catch (const std::exception &e) {
        DisplayMessage(std::string("PostUpdates exception: ") + e.what());
        pendingUpdates.clear(); // Clear updates on error
    } catch (...) {
        DisplayMessage("PostUpdates: Unknown exception");
        pendingUpdates.clear(); // Clear updates on error
    }
    ReleaseMutex(mutex);
}

void VatIRISPlugin::DebugMessage(const std::string &message, const std::string &sender)
{
    if (debug) DisplayMessage(message, sender);
}

void VatIRISPlugin::DisplayMessage(const std::string &message, const std::string &sender)
{
    DisplayUserMessage(PLUGIN_NAME, sender.c_str(), message.c_str(), true, false, false, false, false);
}

bool VatIRISPlugin::FilterFlightPlan(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    try {
        if (!FlightPlan.IsValid()) return false;
        
        EuroScopePlugIn::CFlightPlanData fpData = FlightPlan.GetFlightPlanData();
        if (!fpData.IsReceived()) return false;
        
        const char* origin = fpData.GetOrigin();
        const char* destination = fpData.GetDestination();
        if (!origin || !destination || !*origin || !*destination) return false;
        
        // Safe string comparison with length check
        if (strlen(origin) < 2 || strlen(destination) < 2) return false;
        if (strncmp(origin, "ES", 2) != 0 && strncmp(destination, "ES", 2) != 0) return false;
        
        return true;
    } catch (...) {
        DisplayMessage("FilterFlightPlan: Exception occurred");
        return false;
    }
}

void VatIRISPlugin::UpdateRoute(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    try {
        // Limit the size of flight updates
        if (pendingUpdates.size() > 1000) {
            DebugMessage("Too many pending updates in UpdateRoute");
            pendingUpdates.clear();
        }

        std::string callsign = FlightPlan.GetCallsign();
        if (callsign.empty() || callsign.length() > 20) {
            DisplayMessage("UpdateRoute: Invalid callsign");
            return;
        }

        if (pendingUpdates.size() > 1000) {
            DebugMessage("Too many pending updates, clearing old ones");
            pendingUpdates.clear();
        }

        EuroScopePlugIn::CFlightPlanData fpData = FlightPlan.GetFlightPlanData();
        if (!fpData.IsReceived()) return;

        const char *arrRwy = fpData.GetArrivalRwy();
        const char *starName = fpData.GetStarName();
        const char *depRwy = fpData.GetDepartureRwy();
        const char *sidName = fpData.GetSidName();

        // Safer string handling with explicit null checks and length limits
        if (arrRwy && *arrRwy && strlen(arrRwy) < 5) pendingUpdates[callsign]["arrRwy"] = arrRwy;
        if (starName && *starName && strlen(starName) < 10) pendingUpdates[callsign]["star"] = starName;
        if (depRwy && *depRwy && strlen(depRwy) < 5) pendingUpdates[callsign]["depRwy"] = depRwy;
        if (sidName && *sidName && strlen(sidName) < 10) pendingUpdates[callsign]["sid"] = sidName;

        // int ete = FlightPlan.GetPositionPredictions().GetPointsNumber();
        // if (ete > 0) {
        //     try {
        //         pendingUpdates[callsign]["eta"] =
        //         std::format("{:%FT%TZ}", std::chrono::system_clock::now() + std::chrono::minutes(ete));
        //     } catch (const std::exception &e) {
        //         DisplayMessage(std::string("UpdateRoute format exception: ") + e.what());
        //     }
        // }
    } catch (const std::exception &e) {
        DisplayMessage(std::string("UpdateRoute exception: ") + e.what());
    } catch (...) {
        DisplayMessage("UpdateRoute: Unknown exception");
    }
}

} // namespace VatIRIS
