import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/announcements_repository.dart';
import '../domain/announcement.dart';

/// All announcements visible to the current session, per `GET /announcements`.
final FutureProvider<List<Announcement>> announcementsListProvider =
    FutureProvider<List<Announcement>>(
  (ref) => ref.watch(announcementsRepositoryProvider).list(),
);

/// A single announcement by id, per `GET /announcements/:id` — kept separate
/// from [announcementsListProvider] since only this endpoint returns the
/// `attachments` array.
final FutureProviderFamily<Announcement, String> announcementDetailProvider =
    FutureProvider.family<Announcement, String>(
  (ref, id) => ref.watch(announcementsRepositoryProvider).getById(id),
);
