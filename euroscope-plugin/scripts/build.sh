#!/bin/bash -e
cd "$(dirname $0)/.."
export PATH="/c/Program Files/CMake/bin:$PATH"
rm -rf build
mkdir build
cd build
cmake -A win32 ..
cmake --build . --config Release

if [ -d "$APPDATA/EuroScope/ESAA/Plugins" ]; then
    cp -f Release/VatIRIS.dll "$APPDATA/EuroScope/ESAA/Plugins/"
    echo "Copied DLL to $APPDATA/EuroScope/ESAA/Plugins"
fi
