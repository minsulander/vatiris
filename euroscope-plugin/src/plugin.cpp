#include "plugin.h"
#include "Version.h"
#include "postjson.h"

#include "json.hpp"
#include <chrono>
#include <format>
#include <sstream>
#include <fstream>
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

	GetModuleFileNameA(HINSTANCE(&__ImageBase), DllPathFile, sizeof(DllPathFile));
	std::string settingsPath = DllPathFile;
	settingsPath.resize(settingsPath.size() - strlen("VatIRIS.dll"));
	settingsPath += "VatIRISPlugin.txt";
    std::ifstream settingsFile(settingsPath);
    if (settingsFile.is_open()) {
        std::string line;
        while (std::getline(settingsFile, line)) {
            if (line.empty()) continue;
            std::transform(line.begin(), line.end(), line.begin(), ::tolower);
            if (line == "debug") debug = true;
            else if (line == "updateall") updateAll = true;
            else DisplayMessage("Unknown setting: " + line);
        }
    }
    DebugMessage("Version " + std::string(PLUGIN_VERSION) + (updateAll ? " updateAll" : ""));
}

VatIRISPlugin::~VatIRISPlugin()
{
}

void VatIRISPlugin::OnFlightPlanFlightPlanDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    // TODO remove not really useful
    // if (disabled || !FilterFlightPlan(FlightPlan)) return;
    // std::string callsign = FlightPlan.GetCallsign();
    // std::stringstream out;
    // out << "FlightPlanDataUpdate " << callsign;
    // out << " state " << FlightPlan.GetState() << " fpstate " << FlightPlan.GetFPState();
    // if (FlightPlan.GetSimulated()) out << " simulated";
    // if (strlen(FlightPlan.GetTrackingControllerCallsign()) > 0)
    //     out << " controller " << FlightPlan.GetTrackingControllerCallsign();
    // for (int i = 0; i < FlightPlan.GetExtractedRoute().GetPointsNumber(); i++) {
    //     out << " " << FlightPlan.GetExtractedRoute().GetPointName(i);
    //     out << " (" << FlightPlan.GetExtractedRoute().GetPointAirwayName(i) << ")";
    //     out << " [" << FlightPlan.GetExtractedRoute().GetPointDistanceInMinutes(i) << "]";
    // }
    // out << " closest " << FlightPlan.GetExtractedRoute().GetPointsCalculatedIndex();
    // out << " assigned " << FlightPlan.GetExtractedRoute().GetPointsAssignedIndex();
    // DebugMessage(out.str());
    // UpdateRoute(FlightPlan);
}

void VatIRISPlugin::OnFlightPlanControllerAssignedDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan, int DataType)
{
    if (disabled || !FilterFlightPlan(FlightPlan)) return;
    std::string callsign = FlightPlan.GetCallsign();
    pendingUpdates[callsign]["controller"] = FlightPlan.GetTrackingControllerCallsign();
    std::stringstream out;
    out << "ControllerAssignedDataUpdate " << callsign;
    if (strlen(FlightPlan.GetTrackingControllerCallsign()) > 0)
        out << " controller " << FlightPlan.GetTrackingControllerCallsign();
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
}

void VatIRISPlugin::OnFlightPlanDisconnect(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    // TODO remove not really useful
    // if (disabled || !FilterFlightPlan(FlightPlan)) return;
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
}

void VatIRISPlugin::UpdateMyself()
{
    EuroScopePlugIn::CController me = ControllerMyself();
    if (!me.IsValid()) return;
    std::string callsign = me.GetCallsign();
    pendingUpdates[callsign]["name"] = me.GetFullName();
    pendingUpdates[callsign]["frequency"] = me.GetPrimaryFrequency();
    pendingUpdates[callsign]["controller"] = me.IsController();
    SelectActiveSectorfile();
    for (EuroScopePlugIn::CSectorElement airport =
         SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_AIRPORT);
         airport.IsValid();
         airport = SectorFileElementSelectNext(airport, EuroScopePlugIn::SECTOR_ELEMENT_AIRPORT)) {
        if (airport.IsElementActive(false))
            pendingUpdates[callsign]["rwyconfig"][airport.GetName()]["arr"] = true;
        if (airport.IsElementActive(true))
            pendingUpdates[callsign]["rwyconfig"][airport.GetName()]["dep"] = true;
    }
    for (EuroScopePlugIn::CSectorElement runway = SectorFileElementSelectFirst(EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY);
         runway.IsValid();
         runway = SectorFileElementSelectNext(runway, EuroScopePlugIn::SECTOR_ELEMENT_RUNWAY)) {
        std::string airport = runway.GetAirportName();
        airport.erase(std::remove_if(airport.begin(), airport.end(), ::isspace), airport.end());
        if (runway.IsElementActive(false, 0))
            pendingUpdates[callsign]["rwyconfig"][airport][runway.GetRunwayName(0)]["arr"] = true;
        if (runway.IsElementActive(false, 1))
            pendingUpdates[callsign]["rwyconfig"][airport][runway.GetRunwayName(1)]["arr"] = true;
        if (runway.IsElementActive(true, 0))
            pendingUpdates[callsign]["rwyconfig"][airport][runway.GetRunwayName(0)]["dep"] = true;
        if (runway.IsElementActive(true, 1))
            pendingUpdates[callsign]["rwyconfig"][airport][runway.GetRunwayName(1)]["dep"] = true;
    }
}

void VatIRISPlugin::PostUpdates()
{
    lastPostTime = std::time(NULL);
    if (!mutex) mutex = CreateMutex(NULL, FALSE, NULL);
    DWORD waitResult = WaitForSingleObject(mutex, 0); // Check mutex state
    if (waitResult == WAIT_TIMEOUT) {
        DebugMessage("Post thread is busy");
    } else if (waitResult == WAIT_OBJECT_0) {
        ReleaseMutex(mutex);
        DebugMessage("Posting updates " + std::to_string(pendingUpdates.size()));
        ThreadData *data = new ThreadData{ "backend.vatiris.se", "esdata", pendingUpdates };
        CreateThread(NULL, 0, PostJson, data, 0, NULL);
        pendingUpdates.clear();
    }
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
    if (!updateAll && !FlightPlan.GetTrackingControllerIsMe()) return false;
    if (strncmp(FlightPlan.GetFlightPlanData().GetOrigin(), "ES", 2) != 0 &&
        strncmp(FlightPlan.GetFlightPlanData().GetDestination(), "ES", 2) != 0)
        return false;
    return true;
}

void VatIRISPlugin::UpdateRoute(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    // TODO remove not really useful
    // std::string callsign = FlightPlan.GetCallsign();
    // pendingUpdates[callsign]["origin"] = FlightPlan.GetExtractedRoute().GetPointName(0);
    // pendingUpdates[callsign]["destination"] =
    // FlightPlan.GetExtractedRoute().GetPointName(FlightPlan.GetExtractedRoute().GetPointsNumber() - 1);
    // if (FlightPlan.GetExtractedRoute().GetPointsNumber() > 2) {
    //     pendingUpdates[callsign]["departure"] = FlightPlan.GetExtractedRoute().GetPointAirwayName(1);
    //     pendingUpdates[callsign]["arrival"] = FlightPlan.GetExtractedRoute().GetPointAirwayName(
    //     FlightPlan.GetExtractedRoute().GetPointsNumber() - 2);
    // }
    // int ete = FlightPlan.GetExtractedRoute().GetPointDistanceInMinutes(
    // FlightPlan.GetExtractedRoute().GetPointsNumber() - 1);
    // if (FlightPlan.GetExtractedRoute().GetPointsCalculatedIndex() > 0) {
    //     int timeAtClosest = FlightPlan.GetExtractedRoute().GetPointDistanceInMinutes(
    //     FlightPlan.GetExtractedRoute().GetPointsCalculatedIndex());
    //     if (timeAtClosest > 0) ete -= timeAtClosest;
    // }
    // if (ete > 0)
    //     pendingUpdates[callsign]["eta"] =
    //     std::format("{:%FT%TZ}", std::chrono::system_clock::now() + std::chrono::minutes(ete));
}

} // namespace VatIRIS
