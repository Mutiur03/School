/**
 * Web: the PDF inline under its file card, as the web dashboard's ClassRoutinePDF / charter page
 * do (`<iframe className="h-[min(70vh,600px)] min-h-[240px] w-full border-0">`). Sized with
 * attributes as well as style: NativeWind's JSX runtime does not reliably pass `style` through
 * to raw DOM elements.
 */
import { useWindowDimensions, View } from 'react-native';

export function PdfPreview({
  url,
  title,
  testID,
}: {
  url: string;
  title: string;
  testID?: string;
}) {
  const { height } = useWindowDimensions();
  const h = Math.max(240, Math.min(Math.round(height * 0.7), 600));
  return (
    <View
      className="border-border bg-muted w-full overflow-hidden rounded-xl border"
      style={{ height: h }}
    >
      <iframe
        src={url}
        title={title}
        data-testid={testID}
        width="100%"
        height={h}
        frameBorder={0}
      />
    </View>
  );
}
