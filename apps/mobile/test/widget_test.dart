import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';

void main() {
  testWidgets('AppLogo renders the bundled app icon asset', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppLogo(size: 48)),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
    final image = tester.widget<Image>(find.byType(Image));
    expect(image.image, isA<AssetImage>());
    expect(
      (image.image as AssetImage).assetName,
      'assets/icons/android/play_store_512.png',
    );
  });
}