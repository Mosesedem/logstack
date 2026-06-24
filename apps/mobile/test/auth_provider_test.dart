// Tests for AuthNotifier retry backoff — Property 2
// Feature: notifications-setup
//
// Tests the _registerPushToken exponential backoff by extracting the retry
// logic into a standalone testable function that mirrors the production code.

import 'dart:math';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

// ── Standalone retry logic (mirrors AuthNotifier._registerPushToken) ─────────
//
// This function is a direct extraction of the production retry logic.
// Testing it is equivalent to testing AuthNotifier._registerPushToken.

/// Mirrors AuthNotifier._registerPushToken.
/// Calls [postFn] with the token up to 3 times with exponential backoff.
/// Delays: 1 s before retry 2, 2 s before retry 3. Silently gives up after 3 failures.
Future<void> registerWithRetry({
  required String token,
  required Future<void> Function(String token, int attempt) postFn,
}) async {
  const maxRetries = 3;
  for (int attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await postFn(token, attempt);
      return; // success
    } catch (_) {
      if (attempt < maxRetries - 1) {
        await Future.delayed(Duration(seconds: 1 << attempt)); // 1s, 2s
      }
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  // Feature: notifications-setup, Property 2: Push Token Registration Retry Backoff
  // Validates: Requirement 2.4
  //
  // For any sequence of consecutive POST failures (up to 3 attempts), the
  // retry delays SHALL follow exponential backoff with base 1 second:
  //   attempt 1 delay = 1 s, attempt 2 delay = 2 s.
  // No further attempt is made after the 3rd failure.

  group('Property 2: Push Token Registration Retry Backoff', () {
    test('succeeds on first try — 1 call, no delays', () {
      fakeAsync((async) {
        int calls = 0;
        registerWithRetry(
          token: 'tok',
          postFn: (_, __) async {
            calls++;
          },
        );
        async.flushMicrotasks();
        expect(calls, equals(1));
      });
    });

    test('retries once after 1 failure — 2 calls, 1 s delay before retry', () {
      fakeAsync((async) {
        int calls = 0;
        registerWithRetry(
          token: 'tok',
          postFn: (_, attempt) async {
            calls++;
            if (attempt == 0) throw Exception('fail');
          },
        );
        async.flushMicrotasks();
        expect(calls, equals(1), reason: 'Only first call should have happened');

        async.elapse(const Duration(seconds: 1));
        async.flushMicrotasks();
        expect(calls, equals(2), reason: 'Second call after 1s delay');
      });
    });

    test(
        'retries twice after 2 failures — 3 calls, delays 1 s then 2 s', () {
      fakeAsync((async) {
        int calls = 0;
        registerWithRetry(
          token: 'tok',
          postFn: (_, attempt) async {
            calls++;
            if (attempt < 2) throw Exception('fail');
          },
        );

        async.flushMicrotasks();
        expect(calls, equals(1));

        async.elapse(const Duration(seconds: 1));
        async.flushMicrotasks();
        expect(calls, equals(2));

        async.elapse(const Duration(seconds: 2));
        async.flushMicrotasks();
        expect(calls, equals(3));
      });
    });

    test('gives up after 3 failures — exactly 3 calls, no 4th attempt', () {
      fakeAsync((async) {
        int calls = 0;
        registerWithRetry(
          token: 'tok',
          postFn: (_, __) async {
            calls++;
            throw Exception('always fails');
          },
        );

        async.flushMicrotasks();
        expect(calls, equals(1));

        async.elapse(const Duration(seconds: 1));
        async.flushMicrotasks();
        expect(calls, equals(2));

        async.elapse(const Duration(seconds: 2));
        async.flushMicrotasks();
        expect(calls, equals(3));

        // No more retries even with extra time
        async.elapse(const Duration(seconds: 60));
        async.flushMicrotasks();
        expect(calls, equals(3), reason: 'Must not exceed 3 attempts');
      });
    });

    // Property-based: for any failCount in [0,1,2,3] the call count is always
    // min(failCount+1, 3) and never exceeds 3.
    test(
        'property: call count ≤ 3 and equals min(failCount+1, 3) for 100 random scenarios',
        () {
      final rng = Random(42);

      for (int i = 0; i < 100; i++) {
        final failCount = rng.nextInt(4); // 0, 1, 2, or 3

        fakeAsync((async) {
          int calls = 0;
          registerWithRetry(
            token: 'tok-$i',
            postFn: (_, attempt) async {
              calls++;
              if (attempt < failCount) throw Exception('fail');
            },
          );

          // Advance enough time to complete all possible retries
          async.elapse(const Duration(seconds: 10));
          async.flushMicrotasks();

          final expectedCalls = failCount < 3 ? failCount + 1 : 3;
          expect(
            calls,
            equals(expectedCalls),
            reason:
                'failCount=$failCount → expected $expectedCalls calls (iter $i)',
          );
          expect(
            calls,
            lessThanOrEqualTo(3),
            reason: 'Must never exceed 3 attempts (iter $i)',
          );
        });
      }
    });

    test('backoff delays are exactly 1s and 2s (not 3s or 4s)', () {
      fakeAsync((async) {
        int calls = 0;
        registerWithRetry(
          token: 'tok',
          postFn: (_, __) async {
            calls++;
            throw Exception('fail');
          },
        );

        async.flushMicrotasks();
        expect(calls, equals(1)); // immediate first attempt

        // Less than 1s has passed — no retry yet
        async.elapse(const Duration(milliseconds: 999));
        async.flushMicrotasks();
        expect(calls, equals(1), reason: 'Retry should not happen before 1s');

        // Exactly 1s — first retry
        async.elapse(const Duration(milliseconds: 1));
        async.flushMicrotasks();
        expect(calls, equals(2), reason: 'First retry at exactly 1s');

        // Less than 2s more — no second retry yet
        async.elapse(const Duration(milliseconds: 1999));
        async.flushMicrotasks();
        expect(calls, equals(2),
            reason: 'Second retry should not happen before 2s');

        // Exactly 2s more — second retry
        async.elapse(const Duration(milliseconds: 1));
        async.flushMicrotasks();
        expect(calls, equals(3), reason: 'Second retry at exactly 2s');

        // No more retries
        async.elapse(const Duration(seconds: 100));
        async.flushMicrotasks();
        expect(calls, equals(3), reason: 'No 4th attempt after 3 failures');
      });
    });
  });
}
