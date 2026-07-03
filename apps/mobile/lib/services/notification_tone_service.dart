import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the user's alert notification tone preference.
final notificationToneProvider =
    StateNotifierProvider<NotificationToneNotifier, String>((ref) {
  return NotificationToneNotifier();
});

class NotificationToneNotifier extends StateNotifier<String> {
  static const storageKey = 'notification_tone';
  static const tones = ['default', 'urgent', 'subtle'];

  NotificationToneNotifier() : super('default') {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(storageKey);
    if (saved != null && tones.contains(saved)) {
      state = saved;
    }
  }

  Future<void> setTone(String tone) async {
    if (!tones.contains(tone)) return;
    state = tone;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(storageKey, tone);
  }

  /// Versioned Android channel ID — changing tone creates a new channel.
  static String channelIdFor(String tone) => 'logstack_alerts_$tone';
}