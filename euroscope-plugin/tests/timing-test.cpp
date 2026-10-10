#include "maestro_timing.h"
#include <cassert>
#include <iostream>
int main() {
    using nlohmann::json;
    assert(MaestroInstructionSeconds(json{{"sta",1000000},{"eta",1180000},{"deltaSeconds",0}})==0);
    assert(MaestroInstructionSeconds(json{{"sta",1180000},{"eta",1000000},{"deltaSeconds",-120}})==-120);
    assert(MaestroInstructionSeconds(json{{"sta",1000000},{"eta",1180000},{"deltaSeconds",180}})==180);
    assert(MaestroInstructionSeconds(json{{"sta",1120000},{"eta",1000000}})==120);
    assert(!MaestroInstructionSeconds(json{{"deltaSeconds","invalid"}}));
    assert(!MaestroInstructionSeconds(json{{"deltaSeconds",86401}}));
    std::cout << "PASS: authoritative zero/gain/lose instructions, legacy fallback, invalid timing rejection\n";
}
