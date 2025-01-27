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

    void DebugMessage(const std::string &message, const std::string &sender = "VatIRIS");
    void DisplayMessage(const std::string &message, const std::string &sender = "VatIRIS");

    private:
    bool FilterFlightPlan(EuroScopePlugIn::CFlightPlan FlightPlan);

    bool updateAll;
    bool debug;
    nlohmann::json pendingUpdates;
    std::time_t lastUpdateTime, lastPostTime;
};
} // namespace VatIRIS
