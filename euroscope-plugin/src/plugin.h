#pragma once

#pragma warning(push, 0)
#include "EuroScopePlugIn.h"
#pragma warning(pop)

#include <string>

namespace VatIRIS
{
    class VatIRISPlugin : public EuroScopePlugIn::CPlugIn
    {
    public:
        VatIRISPlugin();
        ~VatIRISPlugin();

        void DisplayMessage(const std::string &message,
                            const std::string &sender = "VatIRIS");
    };
}
