/*  maintenance_controller.h
 *  Declares maintenance task functions for system cleaning, priming, etc.
 *  Integrates with state_manager and aws_manager for robust state and cloud communication.
 *  Author: Nathan Hambleton – 2025
 * -------------------------------------------------------------------------- */

#ifndef MAINTENANCE_CONTROLLER_H
#define MAINTENANCE_CONTROLLER_H

// Start the READY_SYSTEM (prime tubes) maintenance task
void startReadySystemTask();

// Start the EMPTY_SYSTEM maintenance task
void startEmptySystemTask();

// Start the DEEP_CLEAN maintenance task
void startDeepCleanTask();

// Add more maintenance actions as needed

#endif // MAINTENANCE_CONTROLLER_H
