#pragma once
#include <windows.h>
#include <string>
#include <cstring>

// Juha 1.1: EnumWindows title match; WM_COPYDATA, dwData=669,
// UTF-8 sequence JSON including its terminating NUL. Only our ES process.
inline unsigned MaestroBroadcastSequence(const std::string& payload) {
    struct Context { const std::string* payload; unsigned completed=0; } context{&payload};
    EnumWindows([](HWND window, LPARAM value)->BOOL {
        auto& ctx=*reinterpret_cast<Context*>(value);
        DWORD process=0;GetWindowThreadProcessId(window,&process);
        if(process!=GetCurrentProcessId())return TRUE;
        char title[64]{};GetWindowTextA(window,title,sizeof(title));
        if(std::strcmp(title,"MAESTROHiddenWindow")!=0)return TRUE;
        COPYDATASTRUCT data{669,static_cast<DWORD>(ctx.payload->size()+1),const_cast<char*>(ctx.payload->c_str())};
        DWORD_PTR result=0;
        if(SendMessageTimeoutA(window,WM_COPYDATA,0,reinterpret_cast<LPARAM>(&data),SMTO_BLOCK|SMTO_ABORTIFHUNG,100,&result))++ctx.completed;
        return TRUE;
    },reinterpret_cast<LPARAM>(&context));
    return context.completed;
}
