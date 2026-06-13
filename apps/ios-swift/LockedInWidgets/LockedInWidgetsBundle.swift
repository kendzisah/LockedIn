//
//  LockedInWidgetsBundle.swift
//  LockedInWidgets
//
//  Entry point for the LockedIn widget extension. Registers every widget
//  + Live Activity configuration the user can pin to the home screen,
//  Lock Screen, or Dynamic Island.
//

import SwiftUI
import WidgetKit

@main
struct LockedInWidgetsBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        StreakWidget()
        TodayWidget()
        StreakComplication()
        QuickStartWidget()
        if #available(iOS 16.2, *) {
            SessionLiveActivity()
        }
    }
}
