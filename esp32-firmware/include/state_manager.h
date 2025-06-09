/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: state_manager.h
 *  Description: Defines the state management system for tracking the robot's 
 *               operational states, including IDLE, POURING, SETUP, and ERROR.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#ifndef STATE_MANAGER_H
#define STATE_MANAGER_H

// Define the possible states of the robot
enum class State {
    IDLE,
    POURING,
    SETUP,
    MAINTENANCE,
    ERROR
};

// Function declarations
void initializeState();
State getCurrentState();
void setState(State newState);
bool isBusy();
bool isIdle();

#endif // STATE_MANAGER_H
