/// One entry in the language picker. Infra-only scaffold (Phase 6) — only
/// `en` has real translated content; the rest are listed as realistic
/// future options for this Bangladesh-based ERP but stay disabled until
/// `flutter_localizations`/ARB content is actually built out, which is
/// explicitly out of scope for this pass.
class LanguageOption {
  const LanguageOption({required this.code, required this.label, required this.available});

  final String code;
  final String label;
  final bool available;
}

const List<LanguageOption> supportedLanguages = [
  LanguageOption(code: 'en', label: 'English', available: true),
  LanguageOption(code: 'bn', label: 'বাংলা / Bengali', available: false),
  LanguageOption(code: 'hi', label: 'हिन्दी / Hindi', available: false),
];
