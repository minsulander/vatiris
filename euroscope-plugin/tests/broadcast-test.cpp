#include "maestro_broadcast.h"
#include <cassert>
#include <iostream>
std::string received;unsigned messages=0;
LRESULT CALLBACK Receive(HWND w,UINT m,WPARAM a,LPARAM b){
 if(m==WM_COPYDATA){auto* d=reinterpret_cast<COPYDATASTRUCT*>(b);assert(d->dwData==669);assert(d->cbData>0);assert(static_cast<char*>(d->lpData)[d->cbData-1]=='\0');received=static_cast<char*>(d->lpData);++messages;return TRUE;}return DefWindowProcA(w,m,a,b);
}
int main(){
 WNDCLASSA c{};c.lpfnWndProc=Receive;c.hInstance=GetModuleHandleA(nullptr);c.lpszClassName="VatirisProtocolTest";assert(RegisterClassA(&c));
 HWND w=CreateWindowExA(0,c.lpszClassName,"MAESTROHiddenWindow",0,0,0,0,0,nullptr,nullptr,c.hInstance,nullptr);assert(w);
 const std::string json="{\"data\":{\"icao\":\"ESSA\"},\"sequence\":[{\"callsign\":\"TEST\",\"ttlttg_ff\":120}]}";
 assert(MaestroBroadcastSequence(json)==1);assert(messages==1);assert(received==json);
 SetWindowTextA(w,"UnrelatedWindow");assert(MaestroBroadcastSequence(json)==0);assert(messages==1);
 DestroyWindow(w);std::cout<<"PASS: actual Win32 hidden-window delivery, message ID 669, exact JSON including NUL, and receiver title filtering\n";
}
