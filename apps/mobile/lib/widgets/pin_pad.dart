import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class PinPad extends StatelessWidget {
  const PinPad({
    super.key,
    required this.pinLength,
    required this.filledCount,
    required this.onDigit,
    required this.onBackspace,
    this.errorText,
  });

  final int pinLength;
  final int filledCount;
  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(pinLength, (i) {
            final filled = i < filledCount;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 8),
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled
                    ? LogstackColors.accentBlue
                    : LogstackColors.surfaceElevated,
                border: Border.all(
                  color: errorText != null
                      ? LogstackColors.errorRed
                      : LogstackColors.border,
                ),
              ),
            );
          }),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 12),
          Text(
            errorText!,
            style: const TextStyle(
              color: LogstackColors.errorRed,
              fontSize: 13,
            ),
          ),
        ],
        const SizedBox(height: 28),
        _Keypad(onDigit: onDigit, onBackspace: onBackspace),
      ],
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({required this.onDigit, required this.onBackspace});

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'back'],
    ];

    return Column(
      children: keys.map((row) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: row.map((key) {
              if (key.isEmpty) {
                return const SizedBox(width: 80, height: 56);
              }
              if (key == 'back') {
                return _KeyButton(
                  onTap: onBackspace,
                  child: const Icon(Icons.backspace_outlined, size: 22),
                );
              }
              return _KeyButton(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onDigit(key);
                },
                child: Text(
                  key,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }
}

class _KeyButton extends StatelessWidget {
  const _KeyButton({required this.onTap, required this.child});

  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Material(
        color: LogstackColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 80,
            height: 56,
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}