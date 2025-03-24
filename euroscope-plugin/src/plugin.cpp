#include "plugin.h"
#include "Version.h"
#include "postjson.h"

#include "json.hpp"
#include <chrono>
#include <format>
#include <fstream>
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
    mutex = CreateMutex(NULL, FALSE, NULL);

    GetModuleFileNameA(HINSTANCE(&__ImageBase), DllPathFile, sizeof(DllPathFile));
    std::string settingsPath = DllPathFile;
    settingsPath.resize(settingsPath.size() - strlen("VatIRIS.dll"));
    settingsPath += "VatIRISPlugin.txt";
    std::ifstream settingsFile(settingsPath);
    if (settingsFile.is_open()) {
        std::string line;
        while (std::getline(settingsFile, line)) {
            if (line.empty()) continue;
            for (auto &c : line) c = (char) std::tolower(c);
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
        CloseHandle(mutex);
        mutex = NULL;
    }
}

void VatIRISPlugin::OnFlightPlanFlightPlanDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    try {
        if (disabled || !FilterFlightPlan(FlightPlan)) return;
        
        std::string callsign = FlightPlan.GetCallsign();
        if (callsign.empty()) {
            DisplayMessage("OnFlightPlanControllerAssignedDataUpdate: Empty callsign");
            return;
        }
        
        std::stringstream out;
        out << "FlightPlanDataUpdate " << callsign;
        out << " state " << FlightPlan.GetState() << " fpstate " << FlightPlan.GetFPState();
        if (FlightPlan.GetSimulated()) out << " simulated";
        if (strlen(FlightPlan.GetTrackingControllerCallsign()) > 0)
            out << " controller " << FlightPlan.GetTrackingControllerCallsign();
        out << " ete " << FlightPlan.GetPositionPredictions().GetPointsNumber();
        // TODO remove not really useful
        // for (int i = 0; i < FlightPlan.GetExtractedRoute().GetPointsNumber(); i++) {
        //     out << " " << FlightPlan.GetExtractedRoute().GetPointName(i);
        //     out << " (" << FlightPlan.GetExtractedRoute().GetPointAirwayName(i) << ")";
        //     out << " [" << FlightPlan.GetExtractedRoute().GetPointDistanceInMinutes(i) << "]";
        // }
        // out << " closest " << FlightPlan.GetExtractedRoute().GetPointsCalculatedIndex();
        // out << " assigned " << FlightPlan.GetExtractedRoute().GetPointsAssignedIndex();
        DebugMessage(out.str());
        UpdateRoute(FlightPlan);

    } catch (const std::exception& e) {
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
        if (callsign.empty()) {
            DisplayMessage("OnFlightPlanControllerAssignedDataUpdate: Empty callsign");
            return;
        }
        
        const char* controllerCallsign = FlightPlan.GetTrackingControllerCallsign();
        if (controllerCallsign) {
            pendingUpdates[callsign]["controller"] = controllerCallsign;
        }
        
        std::stringstream out;
        out << "ControllerAssignedDataUpdate " << callsign;
        if (controllerCallsign && strlen(controllerCallsign) > 0)
            out << " controller " << controllerCallsign;
        switch (DataType) {
        case EuroScopePlugIn::CTR_DATA_TYPE_SQUAWK:
            out << " squawk " << FlightPlan.GetControllerAssignedData().GetSquawk();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_FINAL_ALTITUDE:
            out << " rfl " << FlightPlan.GetControllerAssignedData().GetFinalAltitude();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_TEMPORARY_ALTITUDE: {
            int cfl = FlightPlan.GetControllerAssignedData().GetClearedAltitude();
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
            out << " comm " << FlightPlan.GetControllerAssignedData().GetCommunicationType();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_SCRATCH_PAD_STRING: {
            if (strlen(FlightPlan.GetControllerAssignedData().GetScratchPadString()) == 0) return;
            std::string scratch = FlightPlan.GetControllerAssignedData().GetScratchPadString();
            out << " scratch " << scratch;
            if (scratch == "LINEUP" || scratch == "ONFREQ" || scratch == "DE-ICE") {
                pendingUpdates[callsign]["groundstate"] = scratch;
            } else if (scratch.find("GRP/S/") != std::string::npos) {
                pendingUpdates[callsign]["stand"] = scratch.substr(6);
            }
            // /PRESHDG/ 
            // /ASP=/ /ASP+/ /ASP-/
            // /ES
            // /C_FLAG_ACK/
            // /C_FLAG_RESET/
            // MISAP_
            // /ROF/SAS525/ESMM_5_CTR
            // /LAM/ROF/ESMM_5_CTR
            // /ROF/RYR6Q/EKCH_F_APP
            // /COB
            // /PLU
            // /TIT
            // /OPTEXT2_REQ/ESMM_7_CTR/LHA3218/NC M7
            // /SBY/RTI/EDDB_S_APP/S290+
            // /ACP/RTI/EDDB_S_APP
            // /SBY/RTI/EDDB_S_APP/S250-
            // /ACP/RTI/EDDB_S_APP
            // /OPTEXT2_REQ/ESSA_M_APP/NRD1121/"NORTH RIDER"
            // /FTEXT/L0
            // /HOLD/ERNOV/
            // /XHOLD/ERNOV/
            // /HOLD//0
            // /ARC+/
            // /ACK_STAR/RISMA3S
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
        case EuroScopePlugIn::CTR_DATA_TYPE_SPEED:
            out << " asp " << FlightPlan.GetControllerAssignedData().GetAssignedSpeed();
            pendingUpdates[callsign]["asp"] = FlightPlan.GetControllerAssignedData().GetAssignedSpeed();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_MACH:
            out << " mach " << FlightPlan.GetControllerAssignedData().GetAssignedMach();
            pendingUpdates[callsign]["mach"] = FlightPlan.GetControllerAssignedData().GetAssignedMach();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_RATE:
            out << " arc " << FlightPlan.GetControllerAssignedData().GetAssignedRate();
            pendingUpdates[callsign]["arc"] = FlightPlan.GetControllerAssignedData().GetAssignedRate();
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_HEADING:
            out << " ahdg " << FlightPlan.GetControllerAssignedData().GetAssignedHeading();
            pendingUpdates[callsign]["ahdg"] = FlightPlan.GetControllerAssignedData().GetAssignedHeading();
            pendingUpdates[callsign]["direct"] = "";
            break;
        case EuroScopePlugIn::CTR_DATA_TYPE_DIRECT_TO:
            out << " direct " << FlightPlan.GetControllerAssignedData().GetDirectToPointName();
            pendingUpdates[callsign]["direct"] = FlightPlan.GetControllerAssignedData().GetDirectToPointName();
            pendingUpdates[callsign]["ahdg"] = 0;
            break;
        }
        for (int i = 0; i < 9; i++) {
            if (strlen(FlightPlan.GetControllerAssignedData().GetFlightStripAnnotation(i)) > 0)
                out << " a" << i << " " << FlightPlan.GetControllerAssignedData().GetFlightStripAnnotation(i);
            // a6 stand
            // a7 C
            // a7 /s+ = - etc
        }
        DebugMessage(out.str());
        UpdateRoute(FlightPlan);
    } catch (const std::exception& e) {
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
    try {
        if (disabled && GetConnectionType() == EuroScopePlugIn::CONNECTION_TYPE_DIRECT) {
            disabled = false;
            DebugMessage("VatIRIS updates enabled");
        } else if (!disabled && GetConnectionType() != EuroScopePlugIn::CONNECTION_TYPE_DIRECT) {
            disabled = true;
            DebugMessage("VatIRIS updates disabled");
            return;
        } else if (disabled) {
            return;
        }

        if (counter % 30 == 0) UpdateMyself();
        if (pendingUpdates.empty()) return;
        if (std::time(NULL) - lastPostTime < (5 + (std::rand() % 10))) return;
        PostUpdates();
    } catch (const std::exception& e) {
        DisplayMessage(std::string("OnTimer exception: ") + e.what());
    } catch (...) {
        DisplayMessage("OnTimer: Unknown exception");
    }
}

void VatIRISPlugin::UpdateMyself()
{
    try {
        EuroScopePlugIn::CController me = ControllerMyself();
        if (!me.IsValid()) {
            DebugMessage("UpdateMyself: Controller not valid");
            return;
        }
        std::string callsign = me.GetCallsign();
        if (callsign.empty()) {
            DebugMessage("UpdateMyself: Empty callsign");
            return;
        }
        
        const char* fullName = me.GetFullName();
        if (fullName) pendingUpdates[callsign]["name"] = fullName;
        
        pendingUpdates[callsign]["frequency"] = me.GetPrimaryFrequency();
        pendingUpdates[callsign]["controller"] = me.IsController();
        pendingUpdates[callsign]["pluginVersion"] = PLUGIN_VERSION;
        
        SelectActiveSectorfile();
        
        for (EuroScopePlugIn::CSectorElement airport =
             SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_AIRPORT);
             airport.IsValid();
             airport = SectorFileElementSelectNext(airport, EuroScopePlugIn::SECTOR_ELEMENT_AIRPORT)) {
            const char* airportName = airport.GetName();
            if (!airportName) {
                DebugMessage("UpdateMyself: Invalid airport name");
                continue;
            }
            if (airport.IsElementActive(false))
                pendingUpdates[callsign]["rwyconfig"][airportName]["arr"] = true;
            if (airport.IsElementActive(true))
                pendingUpdates[callsign]["rwyconfig"][airportName]["dep"] = true;
        }
        
        for (EuroScopePlugIn::CSectorElement runway = SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY);
             runway.IsValid();
             runway = SectorFileElementSelectNext(runway, EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY)) {
            const char* airportName = runway.GetAirportName();
            if (!airportName) {
                DebugMessage("UpdateMyself: Invalid runway airport name");
                continue;
            }
            std::string airport = airportName;
            airport.erase(std::remove_if(airport.begin(), airport.end(), ::isspace), airport.end());
            
            const char* rwyName0 = runway.GetRunwayName(0);
            const char* rwyName1 = runway.GetRunwayName(1);
            
            if (rwyName0 && runway.IsElementActive(false, 0))
                pendingUpdates[callsign]["rwyconfig"][airport][rwyName0]["arr"] = true;
            if (rwyName1 && runway.IsElementActive(false, 1))
                pendingUpdates[callsign]["rwyconfig"][airport][rwyName1]["arr"] = true;
            if (rwyName0 && runway.IsElementActive(true, 0))
                pendingUpdates[callsign]["rwyconfig"][airport][rwyName0]["dep"] = true;
            if (rwyName1 && runway.IsElementActive(true, 1))
                pendingUpdates[callsign]["rwyconfig"][airport][rwyName1]["dep"] = true;
        }
    } catch (const std::exception& e) {
        DisplayMessage(std::string("UpdateMyself exception: ") + e.what());
    } catch (...) {
        DisplayMessage("UpdateMyself: Unknown exception");
    }
}

void VatIRISPlugin::PostUpdates()
{
    lastPostTime = std::time(NULL);
    if (!mutex) {
        DisplayMessage("Mutex not initialized");
        return;
    }

    DWORD waitResult = WaitForSingleObject(mutex, 0); // Check mutex state
    if (waitResult == WAIT_TIMEOUT) {
        DebugMessage("Post thread is busy");
        return;
    }
    auto updates = pendingUpdates;
    pendingUpdates.clear();
    DebugMessage("Posting updates " + std::to_string(updates.size()));
    ThreadData *data = new ThreadData{ "backend.vatiris.se", "esdata", updates };
    HANDLE thread = CreateThread(NULL, 0, PostJson, data, 0, NULL);
    if (thread) {
        CloseHandle(thread);
    } else {
        delete data;
        DisplayMessage("Failed to create post thread");
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
    if (!FlightPlan.IsValid()) return false;
    if (!FlightPlan.GetFlightPlanData().IsReceived()) return false;
    if (!updateAll && !FlightPlan.GetTrackingControllerIsMe()) return false;
    if (!FlightPlan.GetFlightPlanData().GetOrigin()) return false;
    if (!FlightPlan.GetFlightPlanData().GetDestination()) return false;
    if (strncmp(FlightPlan.GetFlightPlanData().GetOrigin(), "ES", 2) != 0 &&
        strncmp(FlightPlan.GetFlightPlanData().GetDestination(), "ES", 2) != 0)
        return false;
    return true;
}

void VatIRISPlugin::UpdateRoute(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    try {
        std::string callsign = FlightPlan.GetCallsign();
        if (callsign.empty()) {
            DisplayMessage("UpdateRoute: Empty callsign");
            return;
        }
        
        EuroScopePlugIn::CFlightPlanData fpData = FlightPlan.GetFlightPlanData();
        if (fpData.IsReceived()) {
            const char* arrRwy = fpData.GetArrivalRwy();
            const char* starName = fpData.GetStarName();
            const char* depRwy = fpData.GetDepartureRwy();
            const char* sidName = fpData.GetSidName();
            
            if (arrRwy && strlen(arrRwy) > 0) pendingUpdates[callsign]["arrRwy"] = arrRwy;
            if (starName && strlen(starName) > 0) pendingUpdates[callsign]["star"] = starName;
            if (depRwy && strlen(depRwy) > 0) pendingUpdates[callsign]["depRwy"] = depRwy;
            if (sidName && strlen(sidName) > 0) pendingUpdates[callsign]["sid"] = sidName;
        }
        
        int ete = FlightPlan.GetPositionPredictions().GetPointsNumber();
        if (ete > 0) {
            try {
                pendingUpdates[callsign]["eta"] = std::format("{:%FT%TZ}", std::chrono::system_clock::now() + std::chrono::minutes(ete));
            } catch (const std::exception& e) {
                DisplayMessage(std::string("UpdateRoute format exception: ") + e.what());
            }
        }
    } catch (const std::exception& e) {
        DisplayMessage(std::string("UpdateRoute exception: ") + e.what());
    } catch (...) {
        DisplayMessage("UpdateRoute: Unknown exception");
    }
}

} // namespace VatIRIS
