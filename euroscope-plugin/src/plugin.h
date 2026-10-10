#pragma once

#pragma warning(push, 0)
#include "EuroScopePlugIn.h"
#pragma warning(pop)

#include "json.hpp"
#include <string>

namespace VatIRIS
{

class VatIRISPlugin : public EuroScopePlugIn::CPlugIn
{
    public:
    VatIRISPlugin();
    ~VatIRISPlugin();

    void OnFlightPlanFlightPlanDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan);
    void OnFlightPlanControllerAssignedDataUpdate(EuroScopePlugIn::CFlightPlan FlightPlan, int DataType);
    void OnFlightPlanDisconnect(EuroScopePlugIn::CFlightPlan FlightPlan);
    bool OnCompileCommand(const char *commandLine);
    void OnTimer(int counter);
    void OnNewMetarReceived(const char *station, const char *metar) override;
    void OnGetTagItem(EuroScopePlugIn::CFlightPlan FlightPlan, EuroScopePlugIn::CRadarTarget RadarTarget,
        int ItemCode, int TagData, char sItemString[16], int *pColorCode, COLORREF *pRGB, double *pFontSize) override;


    private:
    void UpdateMyself();
    void LoadMaestroTiming();
    void BroadcastMaestroSequence();
    void ExportMaestroTelemetry();
    nlohmann::json maestroTiming;
    nlohmann::json maestroSequence;
    unsigned maestroReceivers=0;
    nlohmann::json maestroWinds = nlohmann::json::object();
    std::time_t maestroLoadedAt = 0;
    void PostUpdates();
    void DebugMessage(const std::string &message, const std::string &sender = "VatIRIS");
    void DisplayMessage(const std::string &message, const std::string &sender = "VatIRIS");
    bool FilterFlightPlan(EuroScopePlugIn::CFlightPlan FlightPlan);
    void UpdateRoute(EuroScopePlugIn::CFlightPlan FlightPlan);

    bool disabled;
    bool updateAll;
    bool debug;
    nlohmann::json pendingUpdates;
    std::time_t lastUpdateTime, lastPostTime, enabledTime;
};
} // namespace VatIRIS
