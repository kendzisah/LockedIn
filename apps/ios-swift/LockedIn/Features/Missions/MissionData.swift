import Foundation

/// XP values per difficulty tier.
public struct MissionXPTier: Codable, Equatable, Sendable {
    public let easy: Int
    public let medium: Int
    public let hard: Int

    public init(easy: Int, medium: Int, hard: Int) {
        self.easy = easy
        self.medium = medium
        self.hard = hard
    }
}

/// Variant copy per difficulty tier — used only by core templates whose task
/// description changes per tier.
public struct MissionVariants: Codable, Equatable, Sendable {
    public let easy: String
    public let medium: String
    public let hard: String

    public init(easy: String, medium: String, hard: String) {
        self.easy = easy
        self.medium = medium
        self.hard = hard
    }
}

/// Static mission template. The runtime `Mission` instances are built from
/// these by `MissionsEngine.buildMission`.
public struct MissionTemplate: Equatable, Sendable {
    public let title: String
    public let description: String
    public let type: MissionType
    public let completionType: CompletionType
    public let xp: MissionXPTier
    public let timeGate: String?
    public let variants: MissionVariants?
    /// `daily` (default) or `weekly`.
    public let duration: MissionDuration?
    /// Target value to auto-complete a weekly mission.
    public let progressTarget: Int?
    /// What metric drives progress toward completion.
    public let progressMetric: ProgressMetric?

    public init(
        title: String,
        description: String,
        type: MissionType,
        completionType: CompletionType,
        xp: MissionXPTier,
        timeGate: String? = nil,
        variants: MissionVariants? = nil,
        duration: MissionDuration? = nil,
        progressTarget: Int? = nil,
        progressMetric: ProgressMetric? = nil
    ) {
        self.title = title
        self.description = description
        self.type = type
        self.completionType = completionType
        self.xp = xp
        self.timeGate = timeGate
        self.variants = variants
        self.duration = duration
        self.progressTarget = progressTarget
        self.progressMetric = progressMetric
    }
}

/// Full mission matrix: 10 Core + 105 Goal (7×15) + 40 Weakness (5×8) + 7 Daily
/// Activity = 162 templates. Numbers match the RN file header comment in
/// `apps/mobile/src/features/missions/MissionData.ts:3` ("155 templates" =
/// daily-rotation pool of Core + Goal + Weakness; daily activity sits in a
/// separate dedicated slot).
public enum MissionData {

    // ──────────────────────────────────────────────
    // SLOT 1: Core Missions (10) — universal focus-session variants
    // ──────────────────────────────────────────────

    public static let coreMissions: [MissionTemplate] = [
        MissionTemplate(
            title: "Morning Focus Sprint",
            description: "Complete a focus session before 10 AM",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            variants: MissionVariants(easy: "15-min session", medium: "30-min session", hard: "45-min session")
        ),
        MissionTemplate(
            title: "Deep Work Block",
            description: "Lock in for an extended focus session",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30),
            variants: MissionVariants(easy: "30-min block", medium: "45-min block", hard: "60-min block")
        ),
        MissionTemplate(
            title: "Afternoon Lock In",
            description: "Complete a focus session between 12-5 PM",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            variants: MissionVariants(easy: "15-min session", medium: "30-min session", hard: "45-min session")
        ),
        MissionTemplate(
            title: "Evening Focus Session",
            description: "Lock in during the evening hours (5-9 PM)",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            variants: MissionVariants(easy: "15-min session", medium: "25-min session", hard: "40-min session")
        ),
        MissionTemplate(
            title: "Double Lock In",
            description: "Complete 2 separate focus sessions today",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30),
            variants: MissionVariants(easy: "2 × 15-min", medium: "2 × 25-min", hard: "2 × 30-min")
        ),
        MissionTemplate(
            title: "Focus Marathon",
            description: "Accumulate total focus minutes today",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 35),
            variants: MissionVariants(easy: "45 total min", medium: "60 total min", hard: "90 total min")
        ),
        MissionTemplate(
            title: "Hit Your Daily Goal",
            description: "Reach your daily focus commitment",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 25, medium: 25, hard: 30),
            variants: MissionVariants(easy: "Hit 100% of daily goal", medium: "Hit 100% of daily goal", hard: "Hit 120% of daily goal")
        ),
        MissionTemplate(
            title: "Streak Builder",
            description: "Maintain your streak by locking in today",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            variants: MissionVariants(easy: "Any session today", medium: "20+ min session", hard: "30+ min session")
        ),
        MissionTemplate(
            title: "First Thing Focus",
            description: "Start a focus session within 30 min of opening app",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 15, medium: 20, hard: 25),
            variants: MissionVariants(easy: "Within 30 min", medium: "Within 15 min", hard: "Within 5 min")
        ),
        MissionTemplate(
            title: "Distraction-Free Hour",
            description: "Complete a session with zero phone unlocks",
            type: .focus_session,
            completionType: .auto,
            xp: MissionXPTier(easy: 25, medium: 30, hard: 35),
            variants: MissionVariants(easy: "30 min no unlocks", medium: "45 min no unlocks", hard: "60 min no unlocks")
        )
    ]

    // ──────────────────────────────────────────────
    // SLOT 2: Goal-Specific Missions (15 per goal × 7 goals)
    // ──────────────────────────────────────────────

    public static let goalMissions: [String: [MissionTemplate]] = [
        "Improve my physique": [
            MissionTemplate(title: "Gym Check-In", description: "Log your workout or training session", type: .workout_check, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Cold Shower Challenge", description: "Take a cold shower (2+ minutes)", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Hydration Goal", description: "Drink 2+ liters of water today", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20), timeGate: "After 3 PM"),
            MissionTemplate(title: "No Junk Food Today", description: "Avoid processed food and sugar all day", type: .lifestyle, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 8 PM"),
            MissionTemplate(title: "Morning Workout", description: "Complete a workout before 10 AM", type: .workout_check, completionType: .selfReport, xp: MissionXPTier(easy: 25, medium: 25, hard: 30)),
            MissionTemplate(title: "Step Count Goal", description: "Hit 8,000+ steps today", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 5 PM"),
            MissionTemplate(title: "Sleep Before Midnight", description: "Be in bed with phone locked by 12 AM", type: .lifestyle, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 20, hard: 25), timeGate: "After 11 PM"),
            MissionTemplate(title: "Meal Prep Session", description: "Prepare meals for tomorrow", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "No Alcohol Today", description: "Stay sober for the full day", type: .discipline, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 9 PM"),
            MissionTemplate(title: "Stretching / Mobility", description: "Complete a 10+ min stretching routine", type: .workout_check, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Track Your Macros", description: "Log all meals and macronutrients today", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 6 PM"),
            MissionTemplate(title: "Active Recovery Day", description: "Walk, swim, or do light activity for 20+ min", type: .workout_check, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "No Eating After 8 PM", description: "Close your eating window by 8 PM", type: .lifestyle, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 8 PM"),
            MissionTemplate(title: "Protein Goal", description: "Hit your daily protein target", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 6 PM"),
            MissionTemplate(title: "Cardio Session", description: "Complete 20+ min of cardio", type: .workout_check, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Accountability Partner", description: "Share your workout or progress with someone today", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25))
        ],

        "Build a business or side project": [
            MissionTemplate(title: "Ship One Thing", description: "Complete and publish/deploy one deliverable", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "Write 3 Daily Priorities", description: "List your top 3 tasks for today", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Revenue-Generating Task", description: "Work on something directly tied to income", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Learn Something New", description: "Spend 20+ min learning a skill for your project", type: .reading, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Outreach / Networking", description: "Send 3 messages to potential clients/partners", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Content Creation", description: "Create 1 piece of content for your brand", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Review Weekly Progress", description: "Assess milestones and adjust your plan", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "No Distractions Until Noon", description: "Zero social media/entertainment before 12 PM", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 12 PM"),
            MissionTemplate(title: "Deep Work on Core Feature", description: "60+ min on your most important project task", type: .focus_session, completionType: .selfReport, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "Customer Research", description: "Talk to or research 1 potential customer", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Financial Check-In", description: "Review revenue, expenses, or runway", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Inbox Zero", description: "Clear all business-related messages by end of day", type: .planning, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 5 PM"),
            MissionTemplate(title: "Pitch Practice", description: "Practice explaining your project to someone", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Document a Process", description: "Write down one workflow or SOP", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "End-of-Day Review", description: "Write what you accomplished and tomorrow's plan", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20), timeGate: "After 6 PM")
        ],

        "Increase discipline & self-control": [
            MissionTemplate(title: "No Social Media Today", description: "Avoid all social media apps for 24 hours", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 25, medium: 30, hard: 35), timeGate: "After 9 PM"),
            MissionTemplate(title: "Cold Exposure", description: "Cold shower or ice bath for 2+ minutes", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Make Your Bed", description: "Make your bed within 5 min of waking up", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 10, hard: 15)),
            MissionTemplate(title: "No Excuses Workout", description: "Exercise even if you don't feel like it", type: .workout_check, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Eat Clean All Day", description: "No processed food, sugar, or fast food", type: .lifestyle, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 8 PM"),
            MissionTemplate(title: "Wake Up on First Alarm", description: "No snooze — get up immediately", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Phone-Free First Hour", description: "No phone for 60 min after waking", type: .no_social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Delayed Gratification", description: "Resist one temptation and write what it was", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Do the Hard Thing First", description: "Complete your hardest task before anything fun", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "No YouTube / Netflix", description: "Zero streaming entertainment today", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 9 PM"),
            MissionTemplate(title: "Read 10 Pages", description: "Read 10 pages of a non-fiction book", type: .reading, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Evening Planning", description: "Plan tomorrow's schedule before bed", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20), timeGate: "After 7 PM"),
            MissionTemplate(title: "Say No to One Thing", description: "Decline a distraction or unproductive invite", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Posture Check", description: "Maintain good posture during all focus sessions", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20)),
            MissionTemplate(title: "No Complaining", description: "Go the full day without complaining", type: .discipline, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 8 PM"),
            MissionTemplate(title: "Discipline Challenge", description: "Challenge a friend to complete a discipline task with you today", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25))
        ],

        "Advance my career": [
            MissionTemplate(title: "Industry Reading", description: "Read an article or chapter related to your field", type: .reading, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Skill Building Session", description: "Spend 30+ min learning a professional skill", type: .reading, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Network Outreach", description: "Connect with 1 person in your industry", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Update Your Portfolio", description: "Add or improve one item in your portfolio/resume", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Deep Work on Key Project", description: "60+ min on your highest-impact work task", type: .focus_session, completionType: .selfReport, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "Write Down Career Goals", description: "Revisit and refine your 6-month career vision", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "No Distractions Until Lunch", description: "Zero non-work apps before 12 PM", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 12 PM"),
            MissionTemplate(title: "Ask for Feedback", description: "Request constructive feedback from a peer or mentor", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Public Learning", description: "Share something you learned online (LinkedIn, X)", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Organize Your Workspace", description: "Clean desk, close tabs, organize files", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20)),
            MissionTemplate(title: "Practice a Presentation", description: "Rehearse a pitch, talk, or meeting delivery", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "End-of-Day Wins Log", description: "Write 3 professional accomplishments from today", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20), timeGate: "After 5 PM"),
            MissionTemplate(title: "Apply to One Opportunity", description: "Submit an application, pitch, or proposal", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "Mentor or Help Someone", description: "Share your knowledge with someone junior", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Plan Next Week", description: "Map out your professional priorities for the week", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20))
        ],

        "Study with consistency": [
            MissionTemplate(title: "Study Block", description: "Complete a dedicated 45-min study session", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Review Your Notes", description: "Spend 15+ min reviewing today's material", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Flashcard Session", description: "Complete 20+ flashcards or practice problems", type: .reading, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Teach What You Learned", description: "Explain a concept out loud or to someone", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "No Phone While Studying", description: "Keep phone locked during all study sessions", type: .no_social, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Study Before Fun", description: "Complete study session before any entertainment", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Morning Study Session", description: "Study for 30+ min before noon", type: .focus_session, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Summarize One Topic", description: "Write a 1-paragraph summary of what you learned", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Double Study Day", description: "Complete 2 separate study sessions", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "Clear Study Space", description: "Organize desk and remove all distractions before starting", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 10, hard: 15)),
            MissionTemplate(title: "Practice Problems", description: "Solve 5+ problems without looking at answers", type: .reading, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Plan Tomorrow's Study", description: "Write out exactly what you'll study tomorrow", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20), timeGate: "After 6 PM"),
            MissionTemplate(title: "No Social Media Until Done", description: "Zero social apps until all study is complete", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Study Group / Discussion", description: "Discuss material with a peer for 15+ min", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Weekly Review", description: "Go over everything from this week for 30+ min", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30))
        ],

        "Reduce distractions": [
            MissionTemplate(title: "No Social Media Until Noon", description: "Zero social apps before 12 PM", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 12 PM"),
            MissionTemplate(title: "App Blocker Active", description: "Keep distracting apps blocked for 4+ hours", type: .no_social, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Notification Detox", description: "Turn off all non-essential notifications for the day", type: .no_social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Single-Task Session", description: "Focus on one task only for 30+ min (no tab-switching)", type: .focus_session, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Phone in Another Room", description: "Keep phone out of reach during one focus session", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "No YouTube Today", description: "Avoid YouTube entirely for 24 hours", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 9 PM"),
            MissionTemplate(title: "Screen Time Under X Hours", description: "Keep total screen time below your threshold", type: .no_social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 8 PM"),
            MissionTemplate(title: "Close All Tabs", description: "Start each focus session with a clean browser", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20)),
            MissionTemplate(title: "Airplane Mode Focus", description: "Do one focus session in airplane mode", type: .focus_session, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "No News Today", description: "Avoid news apps and websites all day", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 8 PM"),
            MissionTemplate(title: "Phone-Free Meals", description: "Eat every meal today without phone present", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 7 PM"),
            MissionTemplate(title: "Evening Digital Sunset", description: "No screens after 9 PM", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 9 PM"),
            MissionTemplate(title: "Batch Communication", description: "Check messages only 2 times today", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Unsubscribe from 3 Things", description: "Remove 3 email lists, notifications, or follows", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Grayscale Mode", description: "Put phone in grayscale for the full day", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Screen Time Compare", description: "Compare screen time stats with a friend — lower wins", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25))
        ],

        "Improve emotional control": [
            MissionTemplate(title: "Journaling Session", description: "Write about your emotional state for 10+ min", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Breathing Exercise", description: "Complete a 5+ min breathing or box breathing session", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "No Reactive Messaging", description: "Wait 10 min before replying to anything that triggers you", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Gratitude List", description: "Write 3 things you're grateful for today", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20)),
            MissionTemplate(title: "Identify Your Triggers", description: "Write down 1 emotional trigger you noticed today", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 5 PM"),
            MissionTemplate(title: "Mindful Walk", description: "Take a 15+ min walk with no phone", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "No Complaining", description: "Go the full day without complaining", type: .discipline, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 8 PM"),
            MissionTemplate(title: "Forgiveness Practice", description: "Let go of one thing that's been bothering you", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Phone-Free Evening", description: "No phone after 8 PM", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 8 PM"),
            MissionTemplate(title: "Listen Without Interrupting", description: "In one conversation, only listen — don't react", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Positive Self-Talk", description: "Replace 3 negative thoughts with constructive ones", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Sleep Routine", description: "Start wind-down routine 30 min before bed", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 10 PM"),
            MissionTemplate(title: "Accept One Discomfort", description: "Do something uncomfortable without avoiding it", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Limit Negative Content", description: "Avoid toxic content (news, drama, rage bait) all day", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 8 PM"),
            MissionTemplate(title: "End-of-Day Reflection", description: "Write about your emotional wins and losses today", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20), timeGate: "After 7 PM")
        ]
    ]

    // ──────────────────────────────────────────────
    // SLOT 3: Weakness Missions (8-9 per weakness × 5 weaknesses)
    // ──────────────────────────────────────────────

    public static let weaknessMissions: [String: [MissionTemplate]] = [
        "I scroll when I should execute": [
            MissionTemplate(title: "Phone Down, Work Up", description: "Start a focus session within 5 min of opening app", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "No Social Before Work", description: "Zero social media until first focus session is done", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Delete One Time-Waster", description: "Remove or hide one app that wastes your time", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "App Timer Enforced", description: "Set a 30-min daily limit on your most-used scroll app", type: .no_social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Lock In First, Scroll Later", description: "Complete daily focus goal before any entertainment", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "Replace Scroll with Action", description: "Every time you catch yourself scrolling, do 10 pushups", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Airplane Mode Morning", description: "Stay in airplane mode for 1st hour after waking", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Screen Time Check", description: "Keep social media screen time under 30 minutes today", type: .no_social, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 8 PM"),
            MissionTemplate(title: "Scroll Swap", description: "Every time you catch yourself scrolling, switch to a focus session instead", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25))
        ],

        "I start strong, then fall off": [
            MissionTemplate(title: "Show Up Today", description: "Complete at least 1 focus session (any length)", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Minimum Viable Session", description: "Even if you don't want to, lock in for 10 min", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Streak Check-In", description: "Acknowledge your streak and commit to keeping it", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20)),
            MissionTemplate(title: "Write Why You Started", description: "Write 1 sentence about why you began this journey", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Easy Win", description: "Complete the easiest mission first to build momentum", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20)),
            MissionTemplate(title: "No Zero Days", description: "Do at least one productive thing, no matter how small", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Recommit Ritual", description: "Re-read your goals and restate your commitment", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Tell Someone Your Goal", description: "Share today's goal with a friend for accountability", type: .social, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Finish What You Start", description: "Complete every focus session you begin today — no early exits", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30))
        ],

        "I get emotionally reactive": [
            MissionTemplate(title: "Pause Before Responding", description: "Wait 10 seconds before reacting to any trigger", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Trigger Journal", description: "Write down what triggered you and your reaction", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 5 PM"),
            MissionTemplate(title: "Box Breathing Session", description: "Complete 3 min of box breathing when stressed", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Reframe One Negative", description: "Take a negative thought and find a constructive angle", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "No Arguing Today", description: "Walk away from or de-escalate any conflict", type: .discipline, completionType: .hybrid, xp: MissionXPTier(easy: 20, medium: 25, hard: 30), timeGate: "After 8 PM"),
            MissionTemplate(title: "Emotional Score", description: "Rate your emotional control 1-10 at end of day", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 10, medium: 15, hard: 20), timeGate: "After 7 PM"),
            MissionTemplate(title: "Silent Focus", description: "Complete a focus session in total silence", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Limit Rage Content", description: "Avoid all outrage/drama content today", type: .no_social, completionType: .hybrid, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 8 PM"),
            MissionTemplate(title: "Controlled Response", description: "In one difficult moment today, choose your response instead of reacting", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30))
        ],

        "I relapse into distractions": [
            MissionTemplate(title: "Temptation Bundling", description: "Only allow a reward after completing a focus session", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Environment Reset", description: "Remove one distraction from your physical space", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Relapse Log", description: "Write down when you relapsed and what triggered it", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 6 PM"),
            MissionTemplate(title: "Lock In Marathon", description: "Keep phone locked for 2+ hours straight", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 25, medium: 30, hard: 35)),
            MissionTemplate(title: "One App Deleted", description: "Delete or log out of your biggest distraction app", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Pre-Commitment", description: "Write out exactly when and what you'll work on today", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20)),
            MissionTemplate(title: "Distraction Tally", description: "Count every time you get distracted today", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 6 PM"),
            MissionTemplate(title: "Reward Only After Goal", description: "No entertainment until daily focus goal is hit", type: .focus_session, completionType: .auto, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Urge Surfing", description: "When you feel the urge to open a blocked app, wait 5 min and write what triggered it", type: .journal, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25))
        ],

        "I lack daily consistency": [
            MissionTemplate(title: "Same Time, Every Day", description: "Start your focus session at the same time as yesterday", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Morning Anchor", description: "Complete one productive action within 30 min of waking", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Evening Prep", description: "Prepare tomorrow's workspace/outfit/plan before bed", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 15, hard: 20), timeGate: "After 7 PM"),
            MissionTemplate(title: "Routine Tracker", description: "Complete your entire morning routine as planned", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 20, medium: 25, hard: 30)),
            MissionTemplate(title: "Bedtime Alarm", description: "Be in bed by your target time", type: .lifestyle, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "Time Block Your Day", description: "Write out your schedule in 1-hour blocks before starting work", type: .planning, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25)),
            MissionTemplate(title: "End-of-Day Score", description: "Rate your consistency 1-10 and write one thing to improve tomorrow", type: .reflection, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25), timeGate: "After 7 PM"),
            MissionTemplate(title: "Habit Stack", description: "Attach your focus session to an existing habit (after coffee, after lunch, etc.)", type: .discipline, completionType: .selfReport, xp: MissionXPTier(easy: 15, medium: 20, hard: 25))
        ]
    ]

    // ──────────────────────────────────────────────
    // SLOT 4: Daily Activity Check-In (1 per goal)
    // One signature ritual per goal so every user has XP parity with the
    // physique user's "Gym Check-In". Surfaced as a dedicated slot on the
    // Missions tab — NOT mixed into the daily 3-slot rotation.
    // ──────────────────────────────────────────────

    public static let dailyActivityByGoal: [String: MissionTemplate] = [
        "Improve my physique": MissionTemplate(
            title: "Gym Check-In",
            description: "Log your workout or training session",
            type: .workout_check,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        "Build a business or side project": MissionTemplate(
            title: "Builder Check-In",
            description: "Log at least 1 hour of project work today",
            type: .focus_session,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        "Increase discipline & self-control": MissionTemplate(
            title: "Discipline Check-In",
            description: "Complete your full morning routine as planned",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        "Advance my career": MissionTemplate(
            title: "Career Check-In",
            description: "Log your highest-impact professional task completed today",
            type: .planning,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        "Study with consistency": MissionTemplate(
            title: "Study Check-In",
            description: "Log a completed study session with topic covered",
            type: .focus_session,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        "Reduce distractions": MissionTemplate(
            title: "Screen Time Check-In",
            description: "Screenshot and log your screen time — must be below your target",
            type: .no_social,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        ),
        "Improve emotional control": MissionTemplate(
            title: "Mood Check-In",
            description: "Log your emotional state and one trigger you managed today",
            type: .discipline,
            completionType: .selfReport,
            xp: MissionXPTier(easy: 20, medium: 25, hard: 30)
        )
    ]

    public static func getDailyActivityForGoal(_ goal: String) -> MissionTemplate? {
        dailyActivityByGoal[goal]
    }
}

// MARK: - Mission XP season helpers
//
// Global mission XP seasons: fixed 4-month calendar blocks for all users.
// Season 1 begins January 2026; season number increments forever.
// Separate from the 90-day Discipline Board / guild season helpers.
//
// Ported 1:1 from `apps/mobile/src/features/missions/missionXpSeason.ts`.

public enum MissionXPSeason {
    /// First month of Season 1 (local time): January 2026.
    private static let anchorYear: Int = 2026
    private static let anchorMonthIndex: Int = 0 // January (0-indexed to match JS)
    private static let monthsPerSeason: Int = 4

    /// AsyncStorage key — matches RN exactly.
    public static let storageKey: String = "@lockedin/mission_xp_season_number"

    /// Current mission XP season index, starting at 1 for Jan–Apr 2026.
    /// Uses the device local calendar so everyone in a timezone shares the
    /// same season.
    public static func currentSeasonNumber(date: Date = Date()) -> Int {
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents([.year, .month], from: date)
        let monthsSinceAnchor = ((comps.year ?? 0) - anchorYear) * 12
            + ((comps.month ?? 1) - 1 - anchorMonthIndex)
        if monthsSinceAnchor < 0 { return 1 }
        return Int(floor(Double(monthsSinceAnchor) / Double(monthsPerSeason))) + 1
    }

    public static func currentSeasonLabel(date: Date = Date()) -> String {
        "Season \(currentSeasonNumber(date: date))"
    }
}
