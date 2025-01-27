#include "plugin.h"
#include "Version.h"
#include "postjson.h"

#include "json.hpp"
#include <sstream>
#include <string>
#include <windows.h>
#include <wininet.h>

#pragma comment(lib, "wininet.lib")

namespace VatIRIS
{

VatIRISPlugin::VatIRISPlugin()
: CPlugIn(EuroScopePlugIn::COMPATIBILITY_CODE, PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_AUTHOR, PLUGIN_LICENSE)
{
    lastPostTime = std::time(NULL);
    updateAll = true; // TODO make this configurable/default false
    debug = true; // TODO default false
    DebugMessage("Version " + std::string(PLUGIN_VERSION) + " loaded");
}
VatIRISPlugin::~VatIRISPlugin()
{
}

void VatIRISPlugin::OnFlightPlanFlightPlanDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    if (!FilterFlightPlan(FlightPlan)) return;
    std::stringstream out;
    out << "FlightPlanDataUpdate " << FlightPlan.GetCallsign();
    out << " state " << FlightPlan.GetState() << " fpstate " << FlightPlan.GetFPState();
    if (FlightPlan.GetSimulated()) out << " simulated";
    if (strlen(FlightPlan.GetTrackingControllerCallsign()) > 0)
        out << " controller " << FlightPlan.GetTrackingControllerCallsign();
    for (int i = 0; i < FlightPlan.GetExtractedRoute().GetPointsNumber(); i++) {
        out << " " << FlightPlan.GetExtractedRoute().GetPointName(i);
        out << " (" << FlightPlan.GetExtractedRoute().GetPointAirwayName(i) << ")";
        out << " [" << FlightPlan.GetExtractedRoute().GetPointDistanceInMinutes(i) << "]";
    }
    DebugMessage(out.str());
}

void VatIRISPlugin::OnFlightPlanControllerAssignedDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan, int DataType)
{
    if (!FilterFlightPlan(FlightPlan)) return;
    std::stringstream out;
    out << "ControllerAssignedDataUpdate " << FlightPlan.GetCallsign();
    if (strlen(FlightPlan.GetTrackingControllerCallsign()) > 0)
        out << " controller " << FlightPlan.GetTrackingControllerCallsign();
    switch (DataType) {
    case EuroScopePlugIn::CTR_DATA_TYPE_SQUAWK:
        out << " squawk " << FlightPlan.GetControllerAssignedData().GetSquawk();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_FINAL_ALTITUDE:
        out << " rfl " << FlightPlan.GetControllerAssignedData().GetFinalAltitude();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_TEMPORARY_ALTITUDE:
        out << " cfl " << FlightPlan.GetControllerAssignedData().GetClearedAltitude();
        // 0 - no cleared level (use the final instead of)
        // 1 - cleared for ILS approach
        // 2 - cleared for visual approach
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_COMMUNICATION_TYPE:
        out << " comm " << FlightPlan.GetControllerAssignedData().GetCommunicationType();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_SCRATCH_PAD_STRING:
        if (strlen(FlightPlan.GetControllerAssignedData().GetScratchPadString()) == 0) return;
        out << " scratch " << FlightPlan.GetControllerAssignedData().GetScratchPadString();
        // if LINEUP set groundstate
        // if ONFREQ set groundstate
        // if GRP/S/... set stand
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_GROUND_STATE:
        out << " groundstate " << FlightPlan.GetGroundState();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_CLEARENCE_FLAG:
        out << " clearance " << FlightPlan.GetClearenceFlag();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_DEPARTURE_SEQUENCE:
        out << " dsq"; // TODO where dis dsq?
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_SPEED:
        out << " asp " << FlightPlan.GetControllerAssignedData().GetAssignedSpeed();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_MACH:
        out << " mach " << FlightPlan.GetControllerAssignedData().GetAssignedMach();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_RATE:
        out << " arc " << FlightPlan.GetControllerAssignedData().GetAssignedRate();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_HEADING:
        out << " ahdg " << FlightPlan.GetControllerAssignedData().GetAssignedHeading();
        break;
    case EuroScopePlugIn::CTR_DATA_TYPE_DIRECT_TO:
        out << " direct " << FlightPlan.GetControllerAssignedData().GetDirectToPointName();
        break;
    }
    for (int i = 0; i < 9; i++) {
        if (strlen(FlightPlan.GetControllerAssignedData().GetFlightStripAnnotation(i)) > 0)
            out << " a" << i << " " << FlightPlan.GetControllerAssignedData().GetFlightStripAnnotation(i);
    }
    DebugMessage(out.str());
}

void VatIRISPlugin::OnFlightPlanDisconnect(EuroScopePlugIn::CFlightPlan FlightPlan)
{
    if (!FilterFlightPlan(FlightPlan)) return;
    std::stringstream out;
    out << "FlightPlanDisconnect " << FlightPlan.GetCallsign();
    DebugMessage(out.str());
}

bool VatIRISPlugin::OnCompileCommand(const char *commandLine)
{
    if (strncmp(commandLine, ".vatiris all", 12) == 0) {
        DisplayMessage("Updating all flight plans");
        updateAll = true;
        return true;
    } else if (strncmp(commandLine, ".vatiris mine", 13) == 0) {
        DisplayMessage("Updating my flight plans");
        updateAll = true;
        return true;
    } else if (strncmp(commandLine, ".vatiris test", 13) == 0) {
        pendingUpdates["blah"]["foo"] = "bar";
        lastUpdateTime = std::time(NULL);
        return true;
    }
    return false;
}

void VatIRISPlugin::OnTimer(int counter)
{
    if (pendingUpdates.empty()) return;
    if (std::time(NULL) - lastPostTime < 5) return;
    lastPostTime = std::time(NULL);

    if (!mutex) mutex = CreateMutex(NULL, FALSE, NULL);
    DWORD waitResult = WaitForSingleObject(mutex, 0); // Check mutex state
    if (waitResult == WAIT_TIMEOUT) {
        DebugMessage("Post thread is busy");
    } else if (waitResult == WAIT_OBJECT_0) {
        DebugMessage("Posting updates " + std::to_string(pendingUpdates.size()));
        ReleaseMutex(mutex);
        ThreadData *data = new ThreadData{ "backend.vatiris.se", "esdata", pendingUpdates };
        CreateThread(NULL, 0, PostJson, data, 0, NULL);
    }

    pendingUpdates.clear();
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

} // namespace VatIRIS