#pragma once

#include "json.hpp"
#include <string>
#include <windows.h>

namespace VatIRIS
{
struct ThreadData {
    std::string host;
    std::string path;
    nlohmann::json jsonData;
};

// Function declaration
DWORD WINAPI PostJson(LPVOID lpParameter);

// Global variables declarations
extern HANDLE mutex;
extern std::string connectionError;
} // namespace VatIRIS