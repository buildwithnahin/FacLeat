import 'package:flutter/material.dart';

/// Brand color tokens shared with the Annex ERP web app.
///
/// Keep these in sync with the web app's documented palette
/// (see project CLAUDE.md, section 10 — Color tokens).
class AppColors {
  AppColors._();

  /// Primary blue — active states, CTAs, links, KPI highlights.
  static const Color primary = Color(0xFF2563EB);

  /// Success emerald — healthy / posted / approved states.
  static const Color success = Color(0xFF059669);

  /// Warning amber — pending / attention states.
  static const Color warning = Color(0xFFD97706);

  /// Danger red — critical / rejected / error states.
  static const Color danger = Color(0xFFDC2626);

  /// Dark navy — dark-mode surface / sidebar tone.
  static const Color darkNavy = Color(0xFF0F172A);

  /// Slightly lighter navy, used for elevated surfaces in dark mode.
  static const Color darkSurface = Color(0xFF1E293B);

  /// Neutral canvas background used in light mode.
  static const Color lightCanvas = Color(0xFFF8FAFC);
}
