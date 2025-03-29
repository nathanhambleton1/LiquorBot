#include "state_manager.h"

// Initial state is IDLE
State currentState = State::IDLE;

void initializeState() {
    currentState = State::IDLE;
}

State getCurrentState() {
    return currentState;
}

void setState(State newState) {
    currentState = newState;
}

bool isBusy() {
    return (currentState == State::POURING);
}

bool isIdle() {
    return (currentState == State::IDLE);
}
