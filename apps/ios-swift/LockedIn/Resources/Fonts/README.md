# Fonts

Drop the following `.ttf` files into this directory. The filenames listed below
are what `Info.plist`'s `UIAppFonts` array references — do NOT rename them.

Each PostScript name (the value returned by `Font.postScriptName`) must match
the `FontFamily` raw values in `DesignKit.FontFamily`. If the font you drop in
has a slightly different PostScript name, update either the file or the enum.

Required files:

- `Inter-Regular.ttf` (PostScript: `Inter-Regular`)
- `Inter-Medium.ttf` (PostScript: `Inter-Medium`)
- `InterTight-SemiBold.ttf` (PostScript: `InterTight-SemiBold`)
- `InterTight-Bold.ttf` (PostScript: `InterTight-Bold`)
- `InterTight-ExtraBold.ttf` (PostScript: `InterTight-ExtraBold`)
- `JetBrainsMono-Regular.ttf` (PostScript: `JetBrainsMono-Regular`)
- `JetBrainsMono-Bold.ttf` (PostScript: `JetBrainsMono-Bold`)

Source:
- Inter / Inter Tight — https://rsms.me/inter/ or `@expo-google-fonts/inter`,
  `@expo-google-fonts/inter-tight` in the RN app.
- JetBrains Mono — https://www.jetbrains.com/lp/mono/

After dropping files in, regenerate the project: `xcodegen generate`.
