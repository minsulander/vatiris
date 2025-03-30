#include "postjson.h"
#include <sstream>
#include <wininet.h>

#pragma comment(lib, "wininet.lib")

namespace VatIRIS
{
HANDLE mutex = NULL;
std::string connectionError;

DWORD WINAPI PostJson(LPVOID lpParameter)
{
    std::stringstream err;
    ThreadData *data = static_cast<ThreadData *>(lpParameter);

    WaitForSingleObject(mutex, INFINITE);

    HINTERNET hInternet = InternetOpenA("WinInet JSON POST", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hInternet) {
        err << "Failed to open internet: " << GetLastError();
        connectionError = err.str();
        ReleaseMutex(mutex);
        delete data;
        return 1;
    }

    HINTERNET hConnect = InternetConnectA(hInternet, data->host.c_str(), INTERNET_DEFAULT_HTTPS_PORT,
                                         NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) {
        err << "Failed to connect: " << GetLastError();
        InternetCloseHandle(hInternet);
        connectionError = err.str();
        ReleaseMutex(mutex);
        delete data;
        return 1;
    }

    const char *acceptTypes[] = { "application/json", NULL };
    HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", data->path.c_str(), NULL, NULL,
                                         acceptTypes, INTERNET_FLAG_SECURE | INTERNET_FLAG_RELOAD, 0);
    if (!hRequest) {
        err << "Failed to open request: " << GetLastError();
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        connectionError = err.str();
        ReleaseMutex(mutex);
        delete data;
        return 1;
    }

    std::string jsonString = data->jsonData.dump();
    std::string headers = "Content-Type: application/json\r\n";

    if (!HttpSendRequestA(hRequest, headers.c_str(), headers.length(), (LPVOID)jsonString.c_str(),
                         jsonString.length())) {
        err << "Failed to send request: " << GetLastError();
        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        connectionError = err.str();
        ReleaseMutex(mutex);
        delete data;
        return 1;
    }

    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hInternet);
    connectionError = "";
    ReleaseMutex(mutex);
    delete data;
    return 0;
}
} // namespace VatIRIS