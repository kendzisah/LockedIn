Pod::Spec.new do |s|
  s.name           = 'ExpoScreenTime'
  s.version        = '0.1.0'
  s.summary        = 'Screen Time module for LockedIn'
  s.description    = 'FamilyControls and ManagedSettings integration for app blocking'
  s.license        = 'MIT'
  s.author         = 'LockedIn'
  s.homepage       = 'https://github.com/lockedin'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'

  s.frameworks = 'FamilyControls', 'ManagedSettings'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
